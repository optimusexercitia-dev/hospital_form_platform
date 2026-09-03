---
branch: authz-c2-tier1   # ⛔ RENAMED — the old `c2-tier1-neutralizer` work is MERGED TO MAIN
task: Critical FUP C2 — Tier-1 re-grain, the command-door neutralizer, AND the full 171-enforcer sweep
adrs: [0171, 0079, 0153, 0114, 0118, 0155, 0184]
base_sha: cb66dfa9
created: 2026-08-31
updated: 2026-09-02
status: live
---

# Handoff — C2 Tier-1 re-grain and the command-door neutralizer

## ▶ RESUME HERE

1. `git fetch origin && git switch authz-c2-tier1` (⛔ NOT `c2-tier1-neutralizer` — that branch's
   work is already on `main`; this one carries AE4 + C2)
2. `nvm use` (`.nvmrc` = **24**; `npm run lint` dies at gate 8 on Node 20)
3. Confirm **`.env.local` exists** and **`node_modules` is NON-EMPTY** — both fail silently, and an
   empty `node_modules` makes Node walk up and green a gate using another checkout's toolchain
4. `npx supabase db reset --local` — ⛔ **`npx`, not the global binary.** CLI **2.105.0** dies at the
   seed with `relation "seed_persona_org" does not exist`: `seed.sql` builds a TEMPORARY table and
   2.105's batched applier splits it across sessions. `npx` (2.115.0) seeds correctly. Sanity after:
   `auth.users=36, memberships=43`
5. Read **PROGRESS.md § Now** — it, not this file, is status truth

⛔ Re-measure before relying on anything below — see § Trust.

## Trust

⚠ **Written COLD, in one pass, at high context** — not appended incrementally as the skill
prescribes. Treat the VERIFIED table as the reliable part (each row names its witness) and read
BELIEVED/UNKNOWN as what they say. Figures here are **dated measurements**; both instruments
re-derive theirs per run.

## Goal and scope boundary

C2 (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`) is the class of reachable `prosecdef`, non-trigger, scalar,
non-`bool` command doors that sit outside every `p0-authz-invariant.sh` arm's domain. This branch
**sized Tier 1, re-grained its predicate, and built the instrument that can sweep it**.

⛔ **What this is NOT:**

- ~~**Not a sweep.**~~ ✅ **THE SWEEP HAS RUN — 2026-09-02, 171 of 171: COVERED 109 · BLIND 40 ·
  ERROR 22.** ⛔ **C2 is STILL OPEN, and the reason is the INSTRUMENT, not the doors** — see
  § The anchor is a syntax below.
- **Not a closure of either absorbed item** (`FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN`,
  `FUP-DM5-SIBLING-GUARD-DIFF`). `assume_role` stays **ERROR-shaped, not COVERED**.
- **Not a new ARM.** The neutralizer is a separate periodic harness. "All arms green" still carries
  no claim about this class.
- **Not Tier 2.** Tier 2 (190 doors) is deferred, **not cleared**.
- **Not the AE3 cutover** — see § Blockers, which is the thing that most matters here.

## State

### Done — VERIFIED

| What | Witness | When |
| --- | --- | --- |
| Parent population **427** (345 `public` + 82 `app`) | `scripts/authz-c2-tier1-sizing.sql` (agrees with `ARM=census`'s banner, `p0-authz-invariant.sh:373`) | 2026-08-31 |
| **Tier 1 = 237 (55.5 %)**, Tier 2 = 190, 6/6 positive controls | same instrument, "TIER 1 — THE RE-GRAINED PREDICATE" + controls block | 2026-08-31 |
| Worklist of 237 doors | `supabase/tests/mutation/c2-tier1-doors.txt` (derived; regenerate + diff, never edit) | 2026-08-31 |
| **243** enforcers in the Tier-1 closures; **72** in the bool arm's domain, **171** outside | `c2-command-door-neutralizer.sh` worklist derivation (`$WORK/worklist.tsv`, 171 rows) | 2026-08-31 |
| 458 authz raises across the 171; **457** match the mutation anchor | worklist columns 5/6 (`nraise` vs `nanchored`) | 2026-08-31 |
| ~~Harness verdicts: 5 COVERED, 3 BLIND~~ → **FULL SWEEP: 171/171, COVERED 109 · BLIND 40 · ERROR 22** | `bash supabase/tests/mutation/c2-command-door-neutralizer.sh`; [findings](../reviews/c2-command-door-findings.md) | 2026-09-02 |
| Suite baseline **`Files=259, Tests=8685, PASS`**, **53 s/run** (not the design doc's ~23 s) | `npx supabase test db`, timed | 2026-09-02 |
| DB restored after the sweep — **zero `ROLLBACK FAILED`** | fresh reset → `Files=259, Tests=8685, PASS` | 2026-09-02 |
| `npm run lint` **12/12, exit 0** (gate 12 needed a `python`→`python3` fix) | `npm run lint; echo $?` | 2026-09-02 |
| pgTAP baseline **Files=248, Tests=8289, PASS** on a fresh reset | harness baseline capture (`npx supabase test db`) | 2026-08-31 |
| `npm run lint` **11/11, exit 0** | `npm run lint > /tmp/lint.log 2>&1; echo $?` | 2026-08-31 |
| C1a discharged — §3 A–D end-to-end on `standard` **and** `phi` tier | `docs/deployment/phi-backup-run-log.md` § 2026-08-31 (second run) | 2026-08-31 |
| `seed.sql` creates **zero** `file_objects`; after a clean reset the disposal queue is EMPTY | `grep -c file_objects supabase/seed.sql` = 0; post-reset `select count(*) from public.file_objects` = 0 | 2026-08-31 |
| Local Storage volume **372 files / 108 PHI-tier** vs `storage.objects` **0** after reset | `node scripts/storage-manifest.mjs walk` | 2026-08-31 |
| PROGRESS.md de-duplicated 96,352 → 77,855 B; over-form index lines 78 → 23 | `npm run lint:progress`; the § Follow-ups re-derivation in the FUP body | 2026-08-31 |

### Written but UNVERIFIED

- ~~**The full-sweep cost (~2.2 h+)** is extrapolated from single-case timings.~~ ✅ **MEASURED
  2026-09-02: a full pgTAP suite run is 53 s on this branch (`Files=259, Tests=8685`), not the ~23 s
  the design doc assumes — so the sweep is 171 × 2 × 53 s ≈ **5 h**, and PROGRESS.md's ~6 h budget
  was the honest figure while the design doc's ~2.2 h was not.**
- ✅ **`docs/reviews/c2-command-door-findings.md` NOW EXISTS** — written by the full run, 171 rows.
  ⛔ **It is DERIVED: never hand-edit it.** It reads **106/40/25**; the corrected tally is
  **109/40/22**, because 3 of its ERROR rows are tail-drift artifacts re-measured to COVERED in
  isolation. The correction lives in PROGRESS.md and the register, never in the file.

### The anchor is a syntax, not a property — why the sweep did not close C2

⭐ **The single most important thing on this page.** The harness anchors on
`errcode = '(42501|HC0[A-Z0-9]{2})'`, and that is wrong in **three** directions
(`FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`):

1. **Too narrow.** The class needs a literal `0` in position 3, so `HCDS*` (60 raises, the LGPD
   Art. 18 lane) and `28000` (SQL-standard `invalid_authorization_specification`) are excluded. The
   **gate-fn filter at `:153` uses the same anchor**, so those doors are *structurally absent from
   the worklist* — they appear as neither a verdict nor an ERROR.
2. **Too broad.** `HC0*` is the whole application error space. `HC038` (*"…não pode ser cancelada
   neste estado"*) and `HC043` are **state** guards; `HC039` (*"sem permissão…"*) is the
   authorization one. ⛔ **A verdict here means `HC0*`-coded-guard coverage, NOT authorization
   coverage.**
3. **Cannot span a `;` in the message.** 35 raises fail closed as ERROR — never a false COVERED.
   ✅ **Fix VALIDATED: 2294/2294 matched, 0 regressions** (`docs/reviews/c2-anchor-regex-fix-validation.txt`);
   patch staged at `scratchpad/apply-anchor-fix.sh`. ⛔ Patch the `regexp_replace` **only** — the
   counters must keep the errcode-only anchor, or a missed rewrite stops being visible.

### Not started

- **Keystones.** Designs are written for all of them → `docs/design/authz-c2-blind-keystone-designs.md`.
  ⚠ `cancel_session`'s anchored raise is **HC038, a STATE guard**; its authz is HC039 in a different
  worklist row, so the "obvious" HC039 keystone would **not** flip the verdict.
- **The delta sweep** for `HCDS*`/`28000` after widening the anchor (a NEW population, needs
  re-derivation — not a refresh).
- **The 16 suite-abort doors** (`FUP-C2-SUITE-ABORT-ERROR-CLASS`), incl. ⚠ `submit_response`.
- **Classifying `HC0*` by property** so verdicts can be labelled honestly.
- The 23 PARTIAL follow-up index lines (**move-then-cut**; order matters — cutting first destroys
  the only copy).

### Tree

Branch **`authz-c2-tier1`**, ~115 commits ahead of `origin/main`. ⛔ **The name is a MISNOMER** —
its body is **AE4** work; C2's apparatus was already merged to `main` before it started. AE4 is under
implementation **on a different machine**, blocked awaiting C2, and `origin/authz-c2-tier1` is the
shared line both use — so C2 lands there, not via a merge to `main` (ADR 0184).

## Gates

| Arm / suite | SHA | Result | Exit |
| --- | --- | --- | --- |
| `npm run lint` (**12** gates) | 2026-09-02 | OK | 0 |
| pgTAP full suite | 2026-09-02 | `Files=259, Tests=8685` PASS | 0 |
| `c2-command-door-neutralizer.sh` **FULL, 171/171** | 2026-09-02 | **COVERED 109 · BLIND 40 · ERROR 22** | 1 (BLIND) |

⛔ **DID NOT RUN — name these before claiming coverage:** `ARM=census`, `ARM=hat`, `ARM=floor`,
`ARM=policy`, `ARM=wrapper`, the diff-scoped door sweep (both arms), `npm run test` (vitest),
`npm run e2e:prod`. **Absence of a verdict is not absence of coverage — and it is not coverage.**

## Dead ends — and the mechanism each failed by

The highest-value section: none of this is recoverable from the code or from git history.

- **Sweeping per DOOR.** The 237 doors share 243 enforcers; `app.assert_rca_writable` alone backs
  22. Per-door sweeping re-runs one mutation 22 times. **The unit is the enforcer**; the door list
  is an attribution map.
- **Stubbing a door's body to neutralize it.** `public.grant_role`'s entire body is
  `perform app.grant_role_impl(...)` — stubbing removes the **work** with the **guard**, the suite
  fails because nothing happened, and that reads as **COVERED for the wrong reason**. The mutation
  must isolate the property: rewrite the authz `raise` to `null;` and leave the effect.
- **Depth-0 grain** (door body only) — cheaper (194 vs 387) and **falsified by its own controls**:
  drops `create_case` and `set_participant_patient`, which delegate PHI writes to
  `app._set_participant_patient_unchecked`.
- **Rescuing the TENANCY disjunct.** 92.5 % → 81.0 % (gate-aware) → 74.5 % (minus tenancy roots and
  the hash-chained audit sink, both derived as properties). Drivers stay `cases`, `memberships`,
  `meetings`. It is a **domain tautology**: a DEFINER door bypasses RLS and must re-establish
  tenancy itself. Dropped, not re-grained (ADR 0171).
- **PHI comment convention as a marker.** Prose polarity is not machine-decidable — a positive
  regex captures `patient_xref` (*"is NOT a PHI store"*) and `printed_documents` (*"ZERO PHI in
  columns"*); a column-comment rule captures **0 of 6** canonical PHI stores; 50 base tables carry
  no comment. Usable only in UNION with the hard `has_table_privilege` door-only fact, where it can
  only widen.
- ⛔ **"15 `public` doors have no gate."** A **measurement artifact**, nearly reported as a P0.
  `get_case_patient`, `set_case_patient`, `grant_role` are thin **delegating wrappers** — the gate
  is one call deeper. Ask the question over the **delegation closure**, never the door's own body.
- **`supabase storage cp` on the local stack** — `LegacyStorageUnsupportedOperationError`. No CLI
  route exists to put an object into local Storage; a `@supabase/supabase-js` service-role client is
  required, and **the helper must live inside the repo** (Node resolves `node_modules` from the
  script's path, not cwd). A typeless `new Blob([…])` is refused by the buckets'
  `allowed_mime_types`, and supabase-js does not let `contentType` override the Blob's own type.
- **Impersonating a coordinator with only `sub` + `role` claims.** `auth.uid()` resolves and
  `app.can_write_document(doc, uid)` called directly as `postgres` returns **true**, yet the door
  refuses: `app.is_staff_admin_of_for` is **hat-dependent** (ADR 0106) and false under
  `authenticated` with no `active_role`. ⚠ Testing the predicate directly gives a green the door
  then contradicts. Add `"active_role":"staff_admin"` — the shape `test_helpers.claims_for` builds.
- **Running one pgTAP file as the harness suite.** `npx supabase test db <file>` gives
  `Files=1, Tests=0` and a FAIL for most files — they depend on whole-suite setup. **Full suite is
  the only viable mode**, which is why a case costs 1–2 full runs.
- **Four harness bugs, none of which failed loudly** — detail in
  `docs/design/authz-c2-command-door-neutralizer.md` §6: a shape detector grepping raw TAP against
  a `prove`-style runner (baseline shape `0`, so the abort check passed **vacuously for every
  case**); `swept 0 of 171` exiting **0**; a read loop taking 6 TSV columns into 5 (a patch believed
  applied that was not); and a VERDICTS comment promising a restored re-run the code never did.
- ⛔ **Piping a running sweep through `head`** — can SIGPIPE it mid-mutation and leave a live gate
  open. Redirect to a file. See `.claude/rules/mutation-harnesses-are-not-killable.md`.

## Decisions made in flight

- **RULED (PO), ADR 0171** — Tier 1 re-grained to a gate-aware closure over a PHI-marked relation;
  tenancy disjunct dropped as a domain tautology.
- **RULED (PO)** — C1a is rehearsed through the `subject_request` exemption lane; the **provisional
  retention policy is NOT ratified**. ADR 0114 O1 keeps a retention row provisional until three
  further questions are ruled (trigger events · per-type tier assignment · LGPD Art. 18 vs the
  20-yr floor). ⛔ `HC0DR` therefore still blocks every file whose reason is neither
  `subject_request` nor `duplicate`.
- **PROVISIONAL** — the BLIND-candidate heuristic (intersect the worklist with
  `authz-neverclled-door-allowlist.txt`) is a **candidate generator, not a predictor**: that
  allowlist's header records that a deny-only `throws_ok` never registers as a call. 3 of 3 held;
  nobody has ruled it a method.

## Open questions / blockers

- ✅ **CLEARED 2026-09-01 — the AE3 schema-first cutover is DISCHARGED** (push → catalog-verified on the remote → Coolify green → §3 smoke PASSED; see PROGRESS.md § Now). ⛔ Two operator obligations remain and leave NO artifact in the tree: rotate the remote DB password, and destroy `~/ae3-preimage.csv.gpg` **together with** its passphrase. The text below is kept as the record of what the blocker WAS.
- ~~**BLOCKER — the AE3 schema-first cutover.**~~ This branch carries **5 unpushed migrations**,
  including `alter table public.profiles drop column cpf / date_of_birth / phone`, and **9 `src/`
  files with 32 references to `public.profile_private_details`**, a table the remote lacks. Merging
  to `main` without the cutover ships code ahead of its schema. Order:
  `supabase db push` → **verify in the remote catalog** → `git push`, governed by
  `docs/deployment/ae3-cutover-runbook.md` (rollback artifact **before** anything runs; it prompts
  for a DB URI and gpg passphrase — a human types those). Rule:
  `.claude/rules/push-schema-before-code.md`.
- **3 BLIND need keystones**, not allowlist entries — allowlisting would make `ARM=floor` and this
  harness AGREE while both measure nothing. `cancel_session` is the sharp one: a test exists and
  still does not notice its guard vanish.
- **`public.save_block_to_library`** — 5 authz raises, 4 anchored. The harness will record it
  **ERROR · UNMUTABLE** rather than partially mutate. Someone must decide whether the 5th raise is
  authz-relevant.
- **19 doors have no enforcer anywhere in their closure** — 16 `app` (structural resolvers,
  believed not PostgREST-reachable) and 3 `public` (`session_context`, `get_feature_flags`,
  `list_my_referral_assignments`, believed self-scoped). ⚠ **BELIEVED, not measured.** They need
  characterising, not sweeping.
- **The retention gate is the steady state, not a fixture quirk** — until ADR 0114 O1's three
  questions are ruled, no non-exempt file is disposable.

## UNKNOWN — named, so it does not read as covered

- The verdict of the **other 163 enforcers**. 3 BLIND in the first 8 is not a rate.
- Whether the 3 BLIND are reachable/exploitable **through the app**; only the DB side was measured.
- ~~Whether the mutation's regex mis-slices any body whose message string contains `;`.~~
  ✅ **RESOLVED 2026-09-02 by code reading — it CANNOT mis-slice.** The anchor is `[^;]*?`, a
  **negated** semicolon class, so a `;` in the message yields a clean **non-match**, never a bad
  slice. No malformed SQL is generated. Three independent guards make ERROR the only reachable
  outcome: the `v_before`/`v_after` counters anchor on the *errcode* (after the message), so such a
  raise is still counted, survives the rewrite, and trips `C2MUT: % raise(s) survived`; `execute
  v_new` sits **downstream** of that check, so a partial mutation never reaches the DB; and the
  `h0 = h1` hash check catches it regardless. ⛔ **The premise was wrong in the safe direction** —
  the handoff predicted invalid SQL; the truth is a silent non-match that fails closed.
- ⛔ **NEW, and more serious than the item it replaces — the anchor's own blind spot.**
  `errcode = '(42501|HC0[A-Z0-9]{2})'` requires a literal `0` in position 3, so the **`HCDS*`
  family (60 raises) and `28000` (6) are outside it** — and because the **gate-fn filter at
  `:153`** uses the same anchor, doors whose authz raises are only those are **structurally absent
  from the 171**, not merely unmutatable. The LGPD Art. 18 DSR lane is the affected surface.
  → `FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`.

## Next task

⭐ **Write the keystones** — cheapest, and it converts known BLIND findings into pinned tests.
Designs are complete in `docs/design/authz-c2-blind-keystone-designs.md`; the DB is free and
`supabase/tests/**` is writable again now the sweep has finished.

⚠ Each keystone needs an **allow leg** (a *successful* call), not just a deny-only `throws_ok` —
these doors also sit in `authz-neverclled-door-allowlist.txt`, and a raise never registers as a
call, so a deny-only test cannot retire the allowlist line. Delete that line in the same commit.

⭐ **Target the clusters, not the list.** Blindness is **not uniform**: correction workflow **4 of 5**
BLIND and interview **6 of 9**, versus referral **3 of 16**.

Then, in cost order: apply the staged anchor fix + delta sweep · diagnose the 16 abort doors
(minutes each) · classify `HC0*` by property.

⛔ **Before the next FULL sweep, fix tail drift** (`FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS`):
~342 consecutive suite runs against one DB degraded it at enforcer 169 and the last three were lost.
Reset periodically inside the sweep and re-capture `BASE_S`, or at minimum reset-and-retry once on a
drift-shaped ERROR.

## Re-derivation appendix

- **Tier 1, the population, the controls, the worklist** —
  `docs/design/authz-c2-tier1-sizing.md` names the invocation; the script prints every figure.
- **The enforcer worklist** — run the harness; it derives `$WORK/worklist.tsv` per run.
- **Harness self-test (proves it can mutate and undo)** — `SELFTEST=1 bash …`.
- **Local DB / branch state** — `git rev-list --count origin/main..HEAD`, `git status`,
  `select count(*) from supabase_migrations.schema_migrations`.
- ⛔ **Any schema / RLS / RPC / authorization question** — the **live catalog** only (`pg_proc` incl.
  `prosecdef`, `pg_policies`, ACLs). Never a migration file, never graphify (CLAUDE.md's binding
  exception).
