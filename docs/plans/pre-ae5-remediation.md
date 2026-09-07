# Pre-AE5 remediation — the nine batches (plan and continuation record)

**Status:** live plan · **Owner:** lead + PO · **Opened:** 2026-09-04 (batches ruled) · **This
revision:** 2026-09-07, written at the end of the session that completed Batches 0–2, for the
session that continues with Batch 3. **Program:** AUTHZ (ADR
[0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md), phase AE5 is
post-pilot by G1 / ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md)).

> ⛔ **Status words here are as-of-writing.** The live state of any batch is its hub
> (`docs/features/<slug>.md`, via [docs/features/INDEX.md](../features/INDEX.md)); the live state
> of any follow-up is its entry in
> [docs/followups/follow-ups-open.md](../followups/follow-ups-open.md). Re-measure before acting on
> a sentence in this file. Migration text and gate figures are stale by design — the catalog and a
> fresh run are the truth (CLAUDE.md § graphify; ADR 0078).

---

## 1. Why these batches exist, and why before AE5

AE5 (*"the remaining roles move to the catalog, one at a time, each through the AE4 template"*,
[authz-evolution.md § AE5](authz-evolution.md)) is **post-pilot** — *"AE0–AE4 gate the pilot. AE5
is post-pilot"* (0162 G1). So "before AE5" means two things, and the batches were derived from
both, on 2026-09-04, because **no entry in the open register was worded as an AE5 blocker**:

1. **What the record literally says must precede AE5.** The only sentences that say "before AE5"
   are the Gate AE4 review's *"Add the converse arm (a declared class must be findable) before
   AE5, when non-empty rows first appear"* (`hardDenyClasses`, Batch 4), the implementation
   audit's *"Decide and encode the model before AE5"* (the entitlement / hard-deny seam, Batch 9),
   and the mid-phase review's *"MEASURE before AE5"* (performance — measured; the entry stays
   open only as `PO to rule`).
2. **Every defect in the AE4 per-role template that AE5 copies eleven times.** The per-role
   checklist (§ AE5: matrix → seed → differential → wrapper cutover → re-key → sweep → runbook →
   Record) runs the **same instruments** on every increment: the diff-scoped door sweep and its
   case deriver, the mutation harnesses, the enforcement manifest, the rollback runbook, the
   registers' Record-step gates. A defect in any of them is paid **eleven times**, and — the
   program's standing lesson — an instrument that is wrong reads exactly like one that is right.

The dependency order below is not arbitrary: Batches 1–3 each need a **multi-hour full sweep**,
and on 2026-09-04 a sweep killed by a tool timeout had left a live authorization gate open with no
trace — so Batch 0 (crash safety) had to land first; Batch 2's re-baseline needed Batch 1's
merge (a full run used to destroy the baseline's hand-authored material); Batch 3's re-baseline
needed Batch 2 to prove the merge on a real run. Batches 4–8 depend on the instruments 0–3 fix;
Batch 9 is not a fix but the opening of AE5's own plan.

**The standing protocol for every batch** (lead-playbook; proven across 0–2): open a hub + record
**before** cutting the branch (gate 13 needs both) · `backend` writes a **FULL plan** before touching
a harness or a committed baseline (they open live gates / rewrite audit records) · every new
detector, arm, selection or classifier outcome is **proven able to fire** on a planted reproducer
with a clean-tree negative control and a discrimination half, on the *production* text, never a
copy · restores are verified **in the catalog three ways** (md5 vs snapshot; degenerate non-`SELECT`
policies **enumerated** to zero rows against the correct container — an unrelated `escalume` stack is
up on this machine; the harness's own preflight arms) · anything > 5 min runs **detached** (never
under a tool timeout; `Start-Process bash.exe` with the script as **argv[1]** — `-ArgumentList
"-c",…` joins unquoted and starts nothing) with its own `WORK` and sentinel path · exit codes read
**bare** · closures on each follow-up's own quoted `Closes when`, clause by clause, disclosing where
the body's condition was used because the register field read `PO to rule` · QA review → fix loop
(≤ 5, each iteration fixing something new; report to the PO at 5) → re-review → **PO approval by
question** → Record step (ledger row with the id **unbolded** — the `LEDGER-ID-BOLD` workaround; hub
→ `complete` with its Current state cut verbatim into the record, `cmp`-verified; ADR accepted;
indexes; lint read bare) → fast-forward merge into `main`, never pushed by the lead.

---

## 2. Concluded — Batches 0, 1, 2

### Batch 0 — Mutation-harness crash safety · hub `HARNESS-CRASH-SAFETY` · merged `main` @ `76d87a4f` (2026-09-04) · ADR [0189](../decisions/0189-one-crash-safety-protocol-across-the-mutation-harnesses.md)

**Why first.** Batches 1–3 need full sweeps on harnesses that, on 2026-09-04, had stranded
`public.cancel_event` with both anchored raises at `null;` for ~4 min, sentinel erased, preflight
blind — *"the exposure is not the finding; the silence is."*

**Closed:** `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE` 🔴 ·
`FUP-AUTHZ-HARNESS-PRECONDITIONS` 🔴 · `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` 🟠 ·
`FUP-AUTHZ-HARNESS-TRANSACTIONAL` 🔴 (**PO ruled detect-only**: the atomic DB-marker was buildable
and NOT built by decision; re-open if a harness ever runs on a DB with more than one owner).

**Built:** a restore is believed only when the **catalog** agrees (psql rc **and** a live md5 /
policy probe = the pre-mutation snapshot); a failed restore **keeps** the sentinel; `RECOVER=1` in
all three sentinel-bearing harnesses (C2, `p0-authz-door-audit.sh`, `p0-authz-writepath-audit.sh`);
`ON_ERROR_STOP=1` on C2's write channel (its absence witnessed: `select 1/0` exited 0); `DEGEN`
arm 4a (residue shape over comment-stripped bodies, 439/439 strandable functions visible, 0 on a
clean tree) + 4b (persisted worklist expectation); both verdict preconditions asserted and
**printed**; `SUITE=` is a subset; `PASS` under a narrowed domain is `ERROR — NARROWED DOMAIN`;
tail drift **bounded** in the C2 neutralizer — `RESET_EVERY` (default 20 on non-subset runs; a
subset resets only when set explicitly; `0` disables), in-flight interlock, reset-and-retry-once.
Two `.claude/rules/` files corrected/retired in the commit that made them true.

**Two of the four follow-ups' own close conditions were measured vacuous and amended visibly** (the
`nraise` comparison compared a number to itself; the `$INFLIGHT.body` hash compared the restore file
against itself). QA: two rounds (4 MAJOR / 4 REC → all fixed). Gate at the tip: pgTAP
262f / 8 876 PASS; four arms HOLD; no production surface touched.

**Left stated, not proven:** no self-healing (by ruling); `p0-authz-invoker-audit.sh` and
`p0-authz-rowdoor-audit.sh` have **no sentinel** (`FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL` 🟠);
arm 4b's `NOT RUN` branch unproven; ⛔ **the tail-drift design reached the C2 harness only — Batch 2
found the door harness had the same defect** (a fix correct at one of two sibling sites reads as
closing the class; now `LEARN-086`).

### Batch 1 — Door-sweep case deriver · hub `DOOR-SWEEP-DERIVER` · merged `main` @ `bbda5392` (2026-09-05) · ADR [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md) (amends 0173, 0079)

**Why.** `scripts/door-sweep-cases.sh` is §6 step 1 for every phase and every AE5 increment, and
it derived **zero cases for a diff that added a gate** (`9a4bbd22`), read only the first line of a
multi-line `door-sweep-targets:` declaration, could not see `ALTER FUNCTION … SECURITY DEFINER`,
selected over the whole working tree so two increments reported a union, and a **full** run of the
sweep silently destroyed the committed findings file's hand-authored material.

**Closed:** `FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE` 🟠 (on a **visibly amended**
condition — ADR 0079 hazard 4 forbids a `setof uuid` door in `CASES`, so "zero cases" became
"zero *doors*"; the load-bearing proof was `app.assert_not_case_excluded`, a derivation the old
script could not produce) · `FUP-DOOR-SWEEP-MARKER-BLIND-TO-CONTINUATION-LINES` 🟠 ·
`FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION` 🟠 · `FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE` 🟠 ·
`FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS` 🟡 · plus the unfiled over-selection
defect (42 → 18 cases on the AE4 range, 0 tokens matching no gate) filed and closed.

**Built:** the deriver **lifts `PRED_DOMAIN`** from the harness (multi-line, explicit substitution,
ABORT on a residual `$`) instead of owning a copy that had already drifted; a door is a **catalog**
fact (`prosecdef`), `CASES` is the sweepable tier only, the rest printed with reasons; `ALTER
FUNCTION … SECURITY DEFINER` read like `ALTER POLICY` (449 `OWNER TO` lines in the baseline → 0
false matches); the whole declaration parsed, unconditionally, with a continuation grammar
(schema-prefix-bearing lines continue; a malformed token is a named error); per-case provenance +
`SCOPE=`/`PATHS=` + the quotable **`SCOPE:` line** on every exit, carrying `derivation: catalog |
PROVISIONAL`; a shared **merge** (`scripts/lib/merge-findings-baseline.sh`) at all four sweeps'
full-run emit — hand-authored = the complement of what the generator produces, protected over the
**whole** baseline, verifier proven to reject the old helper's real losses; `SELFTEST=1` over
committed fixtures (34 scenarios; 20/14 against the pre-unit deriver). Lead-playbook §4 gained
the `SCOPE:`-quote obligation and the self-test beside the four arms; CLAUDE.md §6 step 1 was
later aligned (the sweep runs over the deriver's case list, never judged by eye — review-queue
fix `244974a1`).

**QA: four rounds.** r1 found a genuine blocker — the merge destroyed hand-authored baseline
material at exit 0 because its verifier excluded `| `-leading lines from what it protected; r2–r4
were prose-about-numbers (an ADR describing the pre-fix mechanism; 399 vs 400 vs 401 verdict
rows — the file carries **two** table headers). Gate at the tip green; no production surface.

**Left stated:** no full sweep had run (the merge was proven on copies — Batch 2 exercised it for
real); `9a4bbd22`'s `setof uuid` door owed a targeted case (Batch 2 delivered it); a real
re-baseline lands most hand-annotated rows in `CARRIED` for a human to re-file (Batch 2 measured
275). Filed: `FUP-AUTHZ-DOOR-SWEEP-MARKER-DECLARES-POLICIES-TOO` 🟡.

### Batch 2 — The door-audit arm's domain · hub `PRED-DOMAIN` · merged `main` @ `d7964398` (2026-09-07) · ADR [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md) (amends 0173, 0079)

**Why.** AE5's eleven increments re-key enforcement sites onto the `authz.*` resolvers — the exact
population the door-audit arm structurally could not select (`scope_reaches`,
`candidate_has_permission` matched neither the name nor the identity regex; the three `SETOF
uuid` scope resolvers were excluded by return type before any regex ran).

**Closed:** `FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` 🟠 + `FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS` 🟠
(jointly) · `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` 🟡 ·
`FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE` 🟡 · `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` 🟠
(on QA's two stated conditions; its *"distinguishable"* clause delivered as a distinguishable
**remedy** and disclosed) · `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` (the lead's
playbook line).

**Built:** `PRED_DOMAIN` gains the `authz` **schema axis, bounded to boolean** (unbounded, it
admitted 6 non-boolean functions = 6 guaranteed ERRORs); selection delta exactly the two
resolvers, reverse delta empty — the deriver's lift needed **no** change (that is what lifting
was for); the `SETOF uuid` resolvers get a **committed targeted-case home**
(`supabase/tests/mutation/authz-setvalued-targeted-cases.sh`, universal-set neutralization, its
own degeneracy arms, scheduled in lead-playbook §4) and their **first recorded** verdicts (3/3
COVERED) as census-readable rows; **`NOTICED`**, a fourth outcome — *the suite noticed but a
domain file aborted before finishing its plan* — **ruled by the PO as EVIDENCE, not a verdict**
(disclosed, non-blocking, never relabelled COVERED, remedied by capture-then-assert); the read arm
opens `using` only (the write arm owns `with check`; **11** `(ALL)` rows flipped COVERED → BLIND,
all CAPA/RCA `_write` policies with one shared trap — the same predicate gates both halves, so the
read keystone must assert the *denial* — work-listed in `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` 🟠);
a per-run **`DOMAIN-STATEMENT`** (ADR 0187 D1's Tier-2 sentence byte-exact, self-test extracted
from the ADR; four populations with per-figure provenance; trigger enforcers — 174 `prosecdef`
trigger functions behind 268 wired triggers, derived — stated out of domain).

**The findings baseline re-earned — twice.** Run 1 (12 h 17 m): 228 / 18 / **102 NOTICED** / 5 —
**76–78 of the NOTICED were one signature** (`Tests=8470`, the same aborting referral files on
every policy from ordinal 275 on): **tail drift**, proven with **no originating case** (two tail
cases COVERED alone on a fresh reset; three consecutive cases clean in worklist order) — cumulative
data the suite leaves behind, exactly what a periodic reset bounds. The door harness got Batch 0's
reset design (proven as Batch 0 proved it); run 2 (~15 h, 40 resets = 17 scheduled + 23 retries,
every NOTICED reproducing after its reset): **294 COVERED · 36 BLIND · 23 NOTICED · 0 ERROR**.
Merge verified three ways (426/426 prose lines, 9/9 blocks, 7/7 notes); **275 CARRIED** rows
dispositioned by script per PO ruling (31 hand notes → 15 re-attached, 15 archived verbatim, 1
re-filed; zero lost; 3 census-mandatory re-files).

**QA: one loop** — 3 BLOCK / 9 MAJOR, **all prose claims about measurements written beside correct
measurements** (a "0 of 24" that was 12 of 24; verdicts filed in no census-readable file; a
witness that had gone COVERED the day before the ADR); every fix re-measured; re-review APPROVED.
Gate at the tip **run by the lead**: pgTAP 262f / 8 876 PASS; census 581 live / 604 with a
verdict (QA re-derived from the catalog byte-identical); hat, floor, wrapper HOLD; both
self-tests green. No production surface touched.

**Left stated, not proven — all filed:** the 23 NOTICED (work-list under
`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`; the 4 without an authz-shaped
reddening in `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING` 🟠) · the 11 `(ALL)`
BLINDs · ⛔ **`FROMFINDINGS=1 ARM=policy` (not one of §6's four) is RED pre-existing and
UNREADABLE until `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` 🟠 lands — 12 stale
rows carry COVERED in column 4; never allowlist them** · the targeted home emits no
census-readable rows (`FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS` 🟡) · the merge relocates hand
table headers and its MALFORMED arm has no self-test
(`FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST` 🟡) · the C2 neutralizer's
captured `pg_proc` OIDs survive its own reset
(`FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET` 🟠) · **Tier 2's 190 doors stay
deferred by ADR 0171 and are NOT cleared.** Two process incidents disclosed in the record: a
hand-derived restore filename left a local policy at `qual = true` ~1 min (caught by the same
command's md5 check); two agents shared the tree for ~12 min (nothing lost — run 1's output
reproducible byte-for-byte).

### Also landed between batches
- **CLAUDE.md review queue processed** (`244974a1` on `main`): 21 entries, 4 PO-approved fixes —
  CLAUDE.md §6 step 1 (above), the review skill's ADR 0186 D5 exception, the gate-results rule
  re-pointed a second time, a branch-is-a-live-fact bullet in `docs/worktrees.md` §4. Hook finding
  recorded in the (gitignored) queue header: the `staleness` signal fires on the user's own prompts
  and on sessions that *fix* stale artifacts.
- `docs/lead-playbook.md` §4 now carries: quote the `SCOPE:` line; `SELFTEST=1` beside the four
  arms; the full-run merge nuance on "empty diff"; the set-valued home's schedule; the NOTICED
  class definition.

---

## 3. Yet to start — Batches 3 → 9, in the ruled order

Every id below was confirmed **open** in the register on 2026-09-07. Severity emoji as of that day.

### Batch 3 — Write-arm baseline · `supabase/tests/mutation/p0-authz-writepath-audit.sh` + `docs/reviews/authz-writepath-audit-findings.md` · owner backend

| Follow-up | Mechanism |
|---|---|
| `FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107` 🟠 | The committed findings file holds verdicts for 33 of 107 write policies; `FROMFINDINGS=1` arms compare against committed rows, so *"a door absent from the findings passes vacuously"* — 74 policies have never been verdicted. |
| `FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN` 🟠 | Three `storage.objects` INSERT policies sat outside every arm (`ARM=census` bounds itself to `public`); first measurement owed; ⛔ never allowlist one. |
| `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` 🟠 | Part 1 (the deriver named one arm for a two-arm list) is ruling 4 in the deriver header; Parts 2–4 remain: the write arm exits 0 over an empty set; 9 policies fall in neither arm's domain; a killed run's contamination rule. |

**Why before AE5.** AE5's re-keys are *write-policy* re-keys (`pending-rekey` → done on the
enforcement manifest), and the write arm is the only instrument that measures them — today it
cannot see 74 of 107, and the per-role checklist's *"arms re-pointed (G8)"* step inherits the
apparatus gap.

**Shape of the work.** One full write-path sweep over the widened domain, rows **merged** into the
committed file (the 33 carry hand-merged annotations — Batch 1's merge preserves them; Batch 2
proved it on the door file) — this is the **second** real full run through the merge and the
first on the write arm. Expect: ~13 h detached with `RESET_EVERY` on (port Batch 0's design if the
write arm lacks it — check, do not assume: Batch 2 found the door arm lacked it); a `CARRIED`
block to disposition by PO ruling (the write file carries 2 `## Note`, 1 blockquote region, ~9
annotated rows); the `storage.objects` policies' first verdicts; the "exit 0 over an empty set"
fixed as a FINDING like the deriver's exit 1. Closes-when for `HALF-AIMED` is its own text
(*"either a documented recovery step … or a restore that does not depend on a signal-catchable
trap"*) — Batch 0's sentinel + `RECOVER=1` already satisfies the second route for the door and
writepath harnesses; the closure must say which route and cite the Batch 0 proof.

### Batch 4 — Enforcement manifest + the template's re-key defect · `supabase/tests/vectors/authz-enforcement-manifest.json`, pgTAP `410`, lint arms M6/M7 · owner backend (+ PO for one)

| Follow-up | Mechanism |
|---|---|
| `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` 🟠 | `hardDenyClasses` is `[]` on 43/43 rows; lint arm M7 iterates the list → zero iterations → **cannot fail**; §6.2 has no discrimination control and is blind below depth 1. PO took option (a) — a disclosure — on 2026-09-03; (b) is still owed. Gate AE4 review: *"Add the converse arm … before AE5, when non-empty rows first appear."* |
| `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` 🟠 | The re-keyed `form_item_validations_staff_admin_write` policy is **unreachable** (`authenticated` holds SELECT only); the real writer `public.set_item_validations` still gates on `is_staff_admin_of` — layer 1. Re-review N4: *"a re-key at the policy leaves the DEFINER surface on its legacy gate, and this template is what AE5 will copy."* Owes a class sweep of every `_staff_admin_write` policy for reachability. |
| `FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW` 🟡 (**PO**) | `app.current_professional_read_organizations` carries the permission literal `org.professionals.read` and appears in no `enforcementSites` row — deliberate but undeclared; held green by a by-name pin in `410` §8.5 that must be deleted in the same change. Either answer is defensible; PO call. |
| `FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED` 🟡 | `app._audit_access_authorized` routes a permission to a re-keyed authorizer and appears in no manifest row; ⛔ must NOT be added to `enforcementSites` (that arm would then measure a fiction) — a named note on the manifest row's qualifier or `backend-state.md`. |

**Why before AE5.** The manifest is the per-role template's oracle; F-BLOCK-1's site-axis
recurrence *"AE5 multiplies by 11"*; `HARDDENY` must land as *"ONE change"* (populate/convert the
loop + a discrimination control + §6.2 transitive over the composed-call closure, comment-stripped).
`VALIDATIONS` is a migration → needs the diff-scoped sweep both arms, derived by the Batch 1
deriver (its `SCOPE:` line quoted).

### Batch 5 — Rollback runbook · `docs/deployment/authz-rollback-runbook.md` (+ `authz-rollback-template.sql`) · owner backend, docs-only

`FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR` 🟠 — §6.2 hard-codes four tables and asserts
`EXPECT 4 rows`; the re-key made it six, so an unamended revert *"fails silently green"*. Runbook
is titled for *"every AE5 per-role increment"* (ADR 0162 §1 binds its shape). PO-deferred to
post-merge on 2026-09-03 — the window is open. Also re-measure §6.1's
`can_manage_case_vocabulary` cross-check expiry (it holds *because* rows 31–32 are still
`pending-rekey`). Can ship with Batch 4 (Batch 4's audit-registry note touches the same §6).

### Batch 6 — Register / gate hygiene · lead · `scripts/check-docs-registers.mjs`, `scripts/build-adr-index.mjs`, `docs/progress/phase-ledger.md`

| Follow-up | Mechanism |
|---|---|
| `FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE` 🟡 | `hubHasLedgerRow` cannot match a bold id; every pre-AE4 row is bold; the AE4, HARNESS-CRASH-SAFETY, DOOR-SWEEP-DERIVER and PRED-DOMAIN rows are **unbolded as a workaround** — four rows now load-bearing on their formatting. Fix the matcher (tolerate `**`) **and** the verdict regex (case-insensitive, emoji-tolerant — `# ✅ VERDICT: APPROVED` does not match today; the complete-hub check passes only because the ledger row exists), both proven able to fire; then re-bold the four rows. |
| `FUP-ADR-CROSS-LINKS-HAVE-NO-GATE` 🟠 | 13 broken ADR-to-ADR links; gate 9 never resolves a link **target**; bold inside a label value can swallow the next label. *"Must not be added mid-phase"* — the inter-batch window is the only time. AE5 adds ≥ 11 ADRs. |
| `FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER` 🟠 | A shipped, QA-approved, PO-approved phase absent from the append-only ledger; (a) write its row marked reconstructed; (b) derive whether AE2 is the only one — diff the phases named in the ledger against those with a `docs/progress/<phase>.md` record and a QA verdict, never by eye. |
| `FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD` 🟡 | Closures move the body verbatim but delete the register entry block, so `Closes when` survives only in git history (3 lines in an ~9 000-line archive). Batches 1–2's closures already archive the entry block beside the body — make the rotation script do it by rule, or `lint:progress` assert the archived entry carries the field. |

**Why before AE5.** AE5's eleven Record steps hit the ledger gate eleven times; a broken-link gate
cannot be added mid-phase; the closure procedure should be right before eleven increments close
follow-ups.

### Batch 7 — Privilege surface · lead + PO · `docs/backend-state.md` § Privilege budget, `docs/design/authz-ae1-revoke-partition.md`

| Follow-up | Mechanism |
|---|---|
| `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN` 🟠 | `CEILING: 752`, live 759; one of the seven attributed (ADR 0182), **six not**; ⛔ editing the ceiling is reserved to the PO by the merge rule. Attribute the six (diff the `authenticated`-executable DEFINER set between heads `…005300` and `…007330`), then the PO moves the ceiling by ruling or the unjustified grants are revoked. Durable form: a `lint:*` gate. |
| `FUP-AE1-REVOKE-SET-EXECUTION` 🟠 | AE1 classified 233 revokes and executed **none**; 137 reach `authenticated` only via `PUBLIC` (`proacl IS NULL`), so a plain revoke is a silent no-op. The plan calls these *"pre-live liabilities to retire while the same team is already inside authorization."* |
| `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` 🟢 | Informational anchor: 237 of 467 `app` functions hold `anon` EXECUTE, bounded by a *config line* (the exposed-schema setting), not the ACLs. Not a hole; must not be reported as one. |

**Why before AE5, and after Batch 2.** AE5 substitutes on top of this surface; *"a revoke may not
create sweep blindness"* (RV0's ruling) — so revokes follow the domain widening (Batch 2, done) and
the write-arm baseline (Batch 3), never precede them.

### Batch 8 — `app.can_manage_professional` self/third-party arm · backend, PO-gated

`FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM` 🟠 — `can_manage_professional(p_org, p_uid)`'s first
arm is `coalesce(app.is_admin(), false)`, and `app.is_admin()` reads `auth.uid()` — it answers
about the **caller**, never `p_uid`; one of 13 callers (`can_read_professional_profile`) passes a
third party. Its blocker `BUG-PROF-INACTIVE-001` is **fixed** (2026-09-01, `20261003007190`), so
it is unblocked and awaits the PO; deliberately not folded into that fix so the security fix stayed
attributable. It sits on the re-keyed representative chain (`can_create_professional →
can_manage_professional`) that AE5's `org_admin` increment substitutes through. A production
predicate change → migration → diff-scoped sweep both arms + the targeted home (the predicate's
reachability analysis first).

### Batch 9 — Not fixes: the AE5 plan's opening ADR · lead + PO

What AE5's planning must **open with**, per the record (each item is a decision, not a follow-up):

- **ADR 0176 D8's bundle, decided together, one compatibility migration:** F6 exact-assignment
  active context vs the role-wide hat (audit scope must match); F8 `administrativo` out of
  `authz.roles`; `platform_role` retirement (⚠ the implementation audit recommended retiring it
  *now*; the binding decision defers it into the bundle — do not report them as agreeing);
  F7 one manifest entry per role in `role-catalog.ts`. *"None may be picked off inside a role
  increment."*
- **Audit F5:** *"Positive entitlements, hard denies, lifecycle, and sensitivity are not separated
  into a safe final-authorization seam — decide and encode the model before AE5"*; the
  classification columns (`risk_class`, `sensitivity_ceiling`, `resource_kind`) have **no reader** —
  a consumer appears or the column is removed with a named reason.
- **Arm-3's divergent cells** handed over by ADR 0175 D3 — AE5 rules them, it does not discover
  them.
- `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED` 🟡 — a stated ceiling on `D` (scopes per principal)
  with something that reds, or a ruling that the tenancy model makes a large `D` unreachable.
- `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` 🟡 — its sweep half is done (pgTAP `414`); the
  `search_path = ''` convention is *"a platform-wide decision owing an ADR."*
- The per-role checklist's qualifier (re-review N4): a re-key at the policy leaves the DEFINER
  surface on its legacy gate — the template must re-key the **writer**, not only the policy.
- `holds_role` product callers count down to **zero by AE5-complete** (a bound on completion, not
  an entry condition); *"the catalog is the authority"* may not appear in a gate record before
  AE5-complete (0162 §2; 0172).

---

## 4. Deliberately NOT before AE5

- **Probable register rot — close by writing, not working:** `FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN` 🟠
  (its close condition — a migration re-planning the ascent, then the acceptance re-run — was met by
  ADR 0180's `20261003007310` + runs 6/7 with P1 PASS and P5 at 0.00×; verify against the run
  artifacts, then close) · `FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH` 🟠 (measurement
  discharged per the Gate AE4 re-review; open only as `PO to rule`).
- **Bounded residuals — a ruling, not work:** `FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW` 🟡
  (≤ 20-row page), `FUP-PERF-ANALYZE-ENDS-AE0-COMPARABILITY` 🟠 (a sequencing note for the next perf
  window), `FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED` 🟡, `FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY` 🟡.
- **Own increments, unrelated to the template:** `FUP-SEED-PENDING-PERSONA-CANNOT-REACH-ITS-LAYER`
  (⛔ *"DO NOT FIX `seed.sql` in passing"*), `FUP-C2-TIER1-FLOOR-ARM-HAS-ZERO-SLACK`.
- **Precede AE5 by definition (pilot gate), but are not AE5 work:**
  `FUP-ONE-SUPABASE-PROJECT-SERVES-TEST-AND-PRODUCTION` 🟠 (*"BEFORE THE PILOT LOADS REAL DATA"*;
  Critical-list candidate) · `FUP-AUTHZ-AE3-CUTOVER-OPERATOR-OBLIGATIONS-OWED` 🔴 (the only 🔴 in the
  register that says *"must not reach the pilot"*; no tree artifact) · Critical C1 / C3 / C4 ·
  `FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL` 🟠 (73 doors answer 500 on denial).

---

## 5. Open work Batches 0–2 created (for the batches that follow, or their own increments)

| Follow-up | Where it belongs | Note |
|---|---|---|
| `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` 🟠 | before anyone reads `ARM=policy` again (Batch 3 is the natural home — the write arm has the same shape) | 12 stale COVERED rows in the door file's `## BLIND` section; ⛔ never allowlist |
| `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE` 🟠 | its own increment; carries the 23 NOTICED rows' work-list | a lint pass over the derived population is the cheaper close |
| `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` 🟠 | its own increment (11 keystones on the denial half) | one shared trap, CAPA + RCA |
| `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING` 🟠 | with the above | the 4 weakest NOTICED |
| `FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL` 🟠 · `FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` 🟡 | a small harness increment | inherit Batch 0's protocol and a graded RESULT |
| `FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET` 🟠 | before the next C2 full run | re-resolve by identity, as the door arm does |
| `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS` 🟡 · `FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST` 🟡 | Batch 3 may fold them (it exercises the merge) | red-before-green scenarios per blind spot |
| `FUP-AUTHZ-DOOR-SWEEP-MARKER-DECLARES-POLICIES-TOO` 🟡 | deriver, own small change | the marker grammar for `table / policy` |

---

## 6. Resuming — what the next session does first

1. `git fetch`; `git rev-parse main origin/main` — `main` @ `d7964398` was **97 commits ahead of
   `origin/main`, unpushed**, on 2026-09-07; push state is measured, never quoted.
2. Confirm the local Supabase stack is the right one (`supabase_db_azkbbhskturikxpgmafq`, the one
   with an `authz` schema — `escalume` is unrelated) and that `/tmp` sentinels are 0 bytes
   (stale non-zero ones from other harnesses' self-tests were noted 2026-09-07; the clean catalog
   is the proof they are leftovers).
3. Say `initiate Batch 3` — the lead opens hub `WRITEPATH-BASELINE` (or similar registered id) +
   record, cuts `authz-writepath-baseline`, and `backend` plans FULL first. Budget the full
   writepath run overnight and a `CARRIED` ruling for the PO; port the reset design to the write
   arm if it lacks it (measure).
4. Keep the loop-safety ledger visible to the PO: Batch 0 took 2 QA rounds, Batch 1 four, Batch 2
   two — every QA blocker after the first was a **prose claim about a measurement**; check for
   that shape before sending a unit to review.
