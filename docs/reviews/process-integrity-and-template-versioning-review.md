# QA review — PCI (Process/Case Integrity) + TV (Process-Template Versioning)

- **Reviewer:** `qa` · **Date:** 2026-08-05
- **Branch:** `db/process-case-integrity` · **HEAD:** `80ec496` (unmerged, unpushed)
- **Scope:** ADR [0095](../decisions/0095-process-case-integrity-audit-remediation.md) (migrations `20260906000100`–`001100`, keystones `296`) and ADR [0096](../decisions/0096-process-template-versioning.md) + Amendments 1.1–1.7 (migrations `20260907000100`–`001200`, keystones `297`, E2E `process-template-versioning.spec.ts`)
- **Method:** live-catalog probes (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_constraint`, `pg_indexes`, `pg_trigger`, ACLs), direct PostgREST probes against the running local stack, and targeted greps of the client layer. Migration file text was **not** treated as truth. No `supabase db reset` was performed — the shared local stack was left untouched, and every query ran against a stack reporting `healthy`.

## Verdict

**CHANGES REQUESTED**

One P1 blocker: a live, deterministic, user-reachable feature break introduced by the TV re-key (`F-1`). It is fail-closed, so it is not an authorization hole — but two wired server actions are 100% dead in the template builder, and the phase's green bar did not see it. Everything else audited is either correct or is honestly-recorded, non-blocking debt.

The substrate work in both workstreams is of high quality. Every one of the six defect classes this phase identified was verified **fixed in the catalog**, and I hunted unfixed siblings for each and found none. The blocker is not a substrate defect; it is the client layer, in exactly the seam ADR 0096 A1.5's own TypeScript corollary warns about — one site the corollary's own sweep missed.

---

## 1. Requirements audit

### ADR 0095 — the eleven audit items

| # | Item | State | Evidence |
|---|---|---|---|
| H1 | `case_phases` INSERT guard | ✅ met | `guard_case_phase_status` present; gate is `app.is_client_role()` reading `current_setting('role', true)`, **not** `current_user` (see §3 D1) |
| H1-b | `app.in_case_rpc` composable | ⚠ partial, accepted | `app.recompute_case_status` uses the correct save/restore (`v_prev_rpc`); two siblings still hard-code `'off'` — F-6 |
| H2 | Audit mesh completed | ✅ substrate met; ⚠ coverage debt | 7 triggers live; 2 of 7 keystoned — F-4 |
| H3 | Commission coherence in substrate | ✅ met | 7 coherence guards, all `AFTER` (§3 D3) |
| H4 | `create_case_from_template` tolerates a deleted result | ✅ met | keystoned in `296` |
| M2 | Case-side `blocks[]` integrity | ✅ met | `guard_case_phase_blocks_refs`, `guard_case_phase_blocks_referenced` live on `case_phases` |
| M4–M7 | Composite FK, revokes, FK indexes, RLS initplan | ⚠ revokes partial | revoke sweep covers 18 tables; 66–67 remain — F-3 |
| M8/L1 | Ordering constraints + narrative pairing CHECK | ✅ met | all ordering uniques present **and `DEFERRABLE`** (§3 D2) |

**Decision 2 (three recommendations refuted).** Each refutation is sound and correctly reasoned. The `case_phase_offered_results` freeze argument is right: `app.compute_case_phase_result` discards results absent from it, so deriving it as a view would make the guard circular. The `phase_results` hard-delete refutation is corroborated by an existing keystone (`210`) that deliberately asserts clean cascade. I confirm the `blocks[]` refutation: the template side does carry both arms.

**Decision 3 (deferred).** 3a was superseded by ADR 0096 and built. 3b (`blocks[]` → join table) and 3c (`case_phase_offered_results` rename) remain deferred; both are modeling-purity changes with M2 shipped, and deferring them from a pre-pilot branch is the right call. Not blocking.

### ADR 0096 — D1–D3 and the Amendment rulings

| Ruling | State | Catalog evidence |
|---|---|---|
| **D1** · `title`/`description` on the VERSION | ✅ met | `process_template_versions` carries `title, description, status, collects_patient, case_type_id, version_number, published_at`; `process_templates` carries **none** of them — identity only |
| **D2** · published versions immutable; edit clones | ✅ met, **stronger than spec** | `app.guard_published_template_version` forbids non-status UPDATE unless `status='draft'`, gates status transitions behind `app.in_template_publish_rpc`, and makes **archived** versions undeletable too — deliberately stronger than the `form_versions` precedent, correctly justified in-body |
| **D2** · at most one published, one draft | ✅ met | `process_template_versions_one_published_idx` and `..._one_draft_idx`, both partial UNIQUE on `template_id` |
| **D3** · version-aware UI, reporting OUT | ✅ met | E2E `AC-VersionHistory`, `AC-Provenance-Coordinator`, `AC-Provenance-Staff` |
| **A1.1/3** · `process_templates.status` dropped | ✅ met | absent from `information_schema.columns` |
| **A1.1/4** · `cases.template_version_id` NULLABLE, `ON DELETE RESTRICT` | ✅ met | `is_nullable=YES`; `cases_template_version_id_fkey … ON DELETE RESTRICT` — the audit's SET-NULL gap is closed |
| **A1.2** · re-key must not strand policies | ✅ met | all 6 child policies resolve via `app.commission_of_template_version(template_version_id)`; `process_template_versions` correctly uses identity-grain `app.commission_of_template(template_id)`. The distinctly-named helper (defence 2) is in place and greppable |
| **A1.7** · DROP+CREATE resets the ACL | ✅ met, swept platform-wide | **zero** `anon`-executable functions across all 477 `public` functions (§3 D2) |

**Rule 5 parity.** The remodel genuinely mirrors `forms`/`form_versions`: publish freezes, edit clones, one open draft, children keyed to the version. D1's deliberate divergence (title on the version) is justified and is what closes the one real provenance gap ADR 0096 identified.

**Rule 8/9/10.** Types regenerated (typecheck clean against the new shape); data access is in `src/lib/queries/` and the per-module `actions.ts` layer per the established pattern; guard messages are authored pt-BR with proper SQLSTATEs, not raw Postgres text.

**Keyboard flow.** `AC-Keyboard` drives edit → draft → publish entirely by keyboard, satisfying the per-phase keyboard-only requirement.

---

## 2. Findings, ranked

### F-1 · **P1 BLOCKER** — template narrative edit and delete are dead: an unresolvable PostgREST embed

`src/lib/case-narratives/actions.ts:232-242`

```ts
async function commissionOfTemplateNarrative(
  supabase: SupabaseClient<Database>,
  narrativeSlotId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('process_template_narratives')
    .select('process_templates(commission_id)')      // <-- line 238: no FK path
```

The TV re-key dropped `process_template_narratives.template_id`, which **was** the FK to `process_templates`. The embed above is a one-hop that no longer has an edge to traverse.

**Proven three ways, none of them file text:**

1. **Catalog** — `process_template_narratives` has exactly two outbound FKs: `→ case_narrative_types` and `→ process_template_versions`. No edge to `process_templates`.
2. **PostgREST**, the authority the ADR's own checklist item 4 names. A controlled three-query comparison under identical credentials:

   | Query | Result |
   |---|---|
   | `process_template_narratives?select=process_templates(commission_id)` | **`PGRST200`** — *"no matches were found… Perhaps you meant 'process_template_versions'"* |
   | `process_template_versions?select=process_templates(commission_id)` (the working sibling) | reaches `42501` |
   | `process_template_narratives?select=process_template_versions(process_templates(commission_id))` (the fix) | reaches `42501` |

   Only the broken form fails at **parse time**, before the permission check. It is deterministic and unconditional.
3. **UI wiring** — both callers are live:
   - `updateTemplateNarrative` (`actions.ts:525`) ← `src/components/process-templates/narrative-slot-dialog.tsx:129` (edit-mode submit)
   - `removeTemplateNarrative` (`actions.ts:564`) ← `src/components/process-templates/template-builder-shell.tsx:243` (delete)

**Behaviour.** The helper discards `error` and returns `null`; both callers then return `MESSAGES.missingNarrative`. So editing or deleting a narrative slot in the template builder **always** fails with a misleading pt-BR "slot not found" message. Creating one still works (`addTemplateNarrative` takes `templateVersionId` directly and was repaired).

**Severity.** Not an authorization hole — it fails **closed**, and the RPCs behind it are independently RLS-gated. But it is a shipped-broken, user-reachable feature on the phase's own critical path, and the misleading error will read to a user as data corruption.

**The fix is already written four lines above it.** `commissionOfTemplateVersion` (`actions.ts:220-230`) does the correct resolution, and both sibling modules already use the two-hop form — `src/lib/process-templates/actions.ts:179` (phases) and `:814` (custom fields). Narratives is the one arm that was missed. The corrected embed is verified to resolve (row 3 of the table above).

> This is the repo's standing **"a new door must inherit EVERY sibling arm"** lesson, and simultaneously ADR 0096 A1.5's own TypeScript corollary. That corollary's grep was for *dropped column names*; this site names no dropped column — it names a **relation** that is no longer reachable. The sweep's boundary was an identifier, and the property that broke was an FK **path**. Worth recording: after a column drop, sweep the embeds the column *enabled*, not only the column.

**Requirement violated:** ADR 0096 A1.5 checklist item 4 ("verify the replacement against PostgREST, not `tsc`"); Architecture Rule 9 in spirit (the data-access layer must actually resolve).

---

### F-2 · MAJOR — no test coverage at all for template-narrative edit/remove

This is *why* F-1 shipped green, and it is the finding that outlives F-1.

The defect is deterministic and unconditional. Therefore: **if any test had exercised a successful narrative-slot edit or delete, it would have failed.** The suite is green at 963/963. That is a constructive proof that no E2E, and no unit test, covers either path. Confirmed directly — `e2e/process-template-versioning.spec.ts` does not reference narratives at all, and no spec drives the slot-edit dialog or the delete control.

The phase's E2E covers the versioning lifecycle well (publish, clone-on-edit, idempotent edit, archive-incumbent, provenance on both routes, keyboard, authz arms). The template-builder **narrative-slot CRUD** path has a coverage hole that predates and survives this phase.

**Requested:** a spec covering slot edit + slot remove through the builder UI. Fixing F-1 without this leaves the same class re-openable by the next re-key.

---

### F-3 · MEDIUM — the `TRUNCATE` / `TRIGGER` / `REFERENCES` revoke sweep is 18 tables of ~67

Verified from `information_schema.role_table_grants`: `authenticated` still holds **TRUNCATE on 66 tables**, **TRIGGER on 67**, **REFERENCES on 67**. `20260906000600` covers eighteen.

**Why this is more than housekeeping:** `TRUNCATE` is **not subject to RLS**. A role holding it can empty a table regardless of any policy — the one privilege, as `296:281` itself notes, that a policy-shaped audit cannot see.

**Why it is not a blocker:** the grants are pre-existing Supabase defaults, not a regression from this phase (which strictly *improved* the position), and PostgREST does not expose `TRUNCATE`, so there is no known reachable path.

**But note the standard this phase set for itself.** ADR 0096 A1.7 records, about the anon-EXECUTE leak, that *"'unreachable' is not a security property… it is the argument `20260906000600` already refused."* That refusal was correct, and the same reasoning applies here with the same force. The residue should either be swept or explicitly accepted in writing with the reachability argument stated — not left implicit. I recommend a FUP with a named owner rather than blocking the phase on it.

---

### F-4 · MINOR (verified as described) — audit mesh: 5 of 7 trigger arms uncovered

Confirmed. `296:488-497` enumerates the debt honestly and in the test file itself:

| Trigger | State |
|---|---|
| `cases → trg_audit_cases` | COVERED (t27, DELETE arm) |
| `case_phases → trg_audit_case_phases` | COVERED (t26, INSERT arm) |
| `case_narratives`, `case_custom_field_values`, `case_offered_outcomes`, `case_phase_allowed_results`, `case_phase_offered_results` | **NOT COVERED** |

Rule 11 debt, self-documented, non-blocking. The file also correctly warns against removing §H2 as "redundant" — there are no other audit-mesh tests.

---

### F-5 · MINOR (verified) — the `is_commission_admin_of` disjunct is unexercised

Confirmed, and honestly disclosed at `297:405-411`. Every one of the six policies is a disjunction (`is_member_of`/`is_staff_admin_of` **OR** `is_commission_admin_of`); the keystones drive only the first disjunct, because `test_helpers.bootstrap()` homes both commissions under one org and mints only commission-scoped memberships.

The file's own scoping argument is correct: this does **not** re-open the sweep finding, because `ARM=policy` opens the whole policy, not one disjunct. The org-admin reach arm is a genuine separate gap. Non-blocking; worth a bootstrap persona.

---

### F-6 · MINOR (verified) — two helpers force `app.in_case_rpc` off instead of restoring

Confirmed in `pg_proc`:

- `app.recompute_case_status` — **correct** composable pattern: `v_prev_rpc := coalesce(current_setting('app.in_case_rpc', true), 'off')` … `set_config('app.in_case_rpc', v_prev_rpc, true)`.
- `app.compute_case_phase_result` — three `'on'`/`'off'` pairs, hard-coding `'off'`; **does not restore**.
- `public.sync_case_phase_on_submit` — same shape.

**Judged non-blocking.** The guards (`guard_case_phase_status`, `guard_case_status`, `guard_case_visibility`) *raise* when the flag is off, so a clobbered flag denies a legitimate operation — it fails **CLOSED**, not open. Pre-existing, correctly recorded in ADR 0095's Consequences, and legitimately left to a change that can prove its own fix.

---

### F-7 · INFO — the phase's own feature spec changed after the green gate run

`e2e/process-template-versioning.spec.ts` changed **+118/−39** in `1017d7d`, after the `e2e:prod` green at `43870f9`. **Zero** files under `src/` or `supabase/migrations/` changed since that run, so the green remains valid evidence *for the application code* at HEAD — but the current, strengthened form of the phase's own spec has not been through the full gate. The change tightened authz assertions ("invisible vs denied are different properties"), so it is more likely to red than to mask. Worth one scoped spec run, not a full gate.

### F-8 · INFO — PCI's E2E line is inherited, and PROGRESS says so

`PROGRESS.md:69-74` correctly warns that PCI's own `e2e:prod` run exited 0 while reporting `GATE RED (UNRUN)` (655 of 962 unrun, batches 6–16 `reset FAILED`, caused by TV migration files landing mid-run). PCI inherits TV's clean run. Since both workstreams share one branch and TV's run was at a HEAD containing all PCI migrations, **the inheritance is sound** — one green full-suite run at the final code HEAD covers both. Recorded here only because the honest disclosure deserves to be carried into the review rather than quietly dropped.

---

## 3. Defect classes — fix confirmation and sibling hunt

Each of the six classes this phase hit was re-verified **in the catalog**, and swept for unfixed siblings.

**D1 · `current_user` inside SECURITY DEFINER is inert.** ✅ Fixed, **zero siblings**. Across every `prosecdef=t` function in `public` and `app`, with block and line comments stripped before matching, there are **0** occurrences of `current_user` or `session_user`. `app.is_client_role()` is correctly `prosecdef=f` (INVOKER) and reads `current_setting('role', true)` — the only construction that reflects the caller.

**D2 · A rebuild silently loses properties the original carried.** ✅ All three instances verified fixed, and I asserted the properties rather than the statements:
- **ACL** — **0** of 477 `public` functions are `anon`-executable. Positive twin: 472/477 are `authenticated`-executable; the 5 that are not (`custom_access_token_hook`, `set_referral_patient`, `compute_due_notifications`, `grant_role_for`, `revoke_role_for`) are all legitimately internal/admin. Every one of the 21 phase-touched doors shows `auth_exec=t, anon_exec=f`, including the two DEFINER ones A1.7 names.
- **Policy re-point** — all 6 child policies resolve through `commission_of_template_version`; none stranded on identity grain.
- **DEFERRABLE** — preserved on every re-keyed ordering constraint: `process_template_phases_position_key`, `process_template_narratives_position_key`, `case_phases_position_key`, `case_phases_display_position_key`, `case_narratives_position_key`.

**D3 · A guard on BEFORE pre-empts RLS.** ✅ Verified via `pg_trigger` bit flags. Exactly seven coherence guards fire `AFTER`: `guard_case_narrative_type_coherent`, `guard_case_offered_outcome_coherent`, `guard_case_phase_allowed_results_coherent`, `guard_case_phase_offered_results_coherent`, `guard_case_phase_refs_coherent`, `guard_case_outcome_coherent`, `guard_template_phase_form_coherent` (plus the re-keyed `guard_template_phase_ruleset_content`). RLS denies first.

**D4 · A column name travelling as DATA.** ✅ Fixed, and **backend's no-other-true-positive claim is verified independently**. I swept every `array[…]` literal in all 41 `app.trg_audit%` functions, comments stripped, resolving each function to the table(s) its triggers are attached to and checking every quoted name against `information_schema.columns`.
- The specific fix landed: `app.trg_audit_cases` now carries `'status','outcome_id','case_number','template_version_id','label'` — the process binding is recorded again.
- Exactly **one** residual hit: `app.trg_audit_action_item_status_history` names `'status_id'`, absent from `action_item_status_history`. **False positive** — that array selects keys of two inline `jsonb_build_object('status_id', …)` documents, not table columns, and both documents carry the key. Coherent and correct.

**D5 · A door must not become an existence oracle.** ✅ Verified. `app.commission_of_template_version` is `prosecdef=t` with no authority check — safe to *call*, unsafe to *report through*. Its only callers are internal `app`-schema helpers (`copy_template_version_children`, three guards, `trg_audit_template_narratives`, `validate_template_recommend_when`) plus the RLS policy predicates, where the answer feeds a boolean rather than an error selection. **No public door reports through it.** Backend's refusal of the prescribed fix was correct, and `297` mutation `m3` reds if anyone implements it.

**D6 · One mutation is not evidence of vacuity.** ✅ Resolved correctly. `297:82` records probe `p2` reporting "nothing red" — and the author correctly diagnosed it not as vacuity but as **zero tests run**: the deny-all policy stopped the fixture inserting v1, aborting the suite, and a harness counting only `not ok` lines cannot distinguish 0-failed from 0-run. It was replaced by `m6`, narrow enough to leave the fixture intact. The file generalizes this correctly ("when a probe reports green, check the DENOMINATOR"), and applies the same fork rule to `m9`/`m10`.

---

## 4. Security / RLS

**Independent confirmation of the `ARM=policy` result.** The six policies flagged BLIND are the `_select` + `_staff_admin_write` pairs on `process_template_phases`, `process_template_narratives`, `process_template_outcomes`. Each now carries **both** arms in `297`, seven assertions per table:

| Arm | Assertions |
|---|---|
| ALLOW — owner INSERT admitted by WITH CHECK | `TIP1` `TIN1` `TIO1` |
| ALLOW — plain member READS rows (non-vacuity) | `TIP2` `TIN2` `TIO2` |
| DENY — foreign staff_admin reads ZERO | `TIP3` `TIN3` `TIO3` |
| DENY — foreign INSERT refused **by SQLSTATE 42501**, not by a coherence guard | `TIP4` `TIN4` `TIO4` |
| DENY — foreign DELETE removes ZERO (USING filters silently) | `TIP5` `TIN5` `TIO5` |
| CONTROL — the row SURVIVED (so "removed nothing" ≠ "nothing to remove") | `TIP6` `TIN6` `TIO6` |
| ALLOW — owner UPDATE reached the row (write USING) | `TIP7` `TIN7` `TIO7` |

This is materially better than the bar. Three points deserve credit: the deny arms assert the **specific SQLSTATE** and deliberately build fixtures from the *owning* commission's vocabulary, so a `throws_ok` cannot be satisfied by the HC054/HC030 coherence guard instead of by RLS; the `FOR ALL` policy is correctly treated as **also a read policy** whose USING deny is silent; and the DELETE arms are paired with survival controls. No deny-only keystone among them.

**I checked the obvious hole in that account** — `process_template_custom_fields` was re-keyed by the same migration (`20260907000700`) but appears in no `TI*` label. It is **not** a gap: suite `188` carries all four arms for it (`:81` owner write landed, `:93` cross-commission INSERT → 42501, `:103` cross-commission member reads 0, `:111` owning member reads ≥1), and was updated for the re-key. That is precisely why the BLIND set was six and not eight — the numbers are consistent.

**Other security checks, all clean.** No service-role key reachable client-side. No raw Postgres error text surfaces — guard messages are authored pt-BR carrying `check_violation`, and `mapNarrativeError` maps by SQLSTATE. Published/archived version immutability is enforced at the substrate, not the UI. `cases.template_version_id` is `ON DELETE RESTRICT`, so a version a case ran under cannot be deleted.

---

## 5. Code quality

- **`typecheck` exit 0**; **`lint` exit 0** (eslint `--max-warnings=0` + `lint:css-vars` + `lint:memberships-door`, all clean). Verified by running them, not by citing the record.
- **284 migrations registered == 284 files.**
- **One load-bearing comment verified true.** `src/lib/process-templates/actions.ts:1134-1142` asserts that `status in ('draft','published')` returns at most two rows "because the two partial unique indexes … guarantee it", and the code depends on it (it `.find()`s rather than ordering). **Both indexes exist** — `process_template_versions_one_draft_idx … WHERE (status = 'draft')` and `..._one_published_idx … WHERE (status = 'published')`, both UNIQUE on `template_id`. The claim holds and the unordered `.find()` is sound.
- **Stub sentinels — clean negative.** The remaining `notImplementedE1` / `notImplemented` sites (`src/lib/interviews/actions.ts:928`, `src/lib/participants/actions.ts:101`) are pre-existing ETH·E1 contract stubs. All ten exported functions that throw through them have **zero** references anywhere outside their own module — not imported by any page, component, or spec. They are genuinely unreachable, not a dead-feature repeat.
- **`supabase/seed.sql` and `supabase/demo/*` are clean.** Both were checked explicitly because the demo tree is in nobody's ownership scope and executed by no gate (`config.toml` `sql_paths` excludes it), and was broken once by this column drop. Every insert is correctly re-keyed: demo `process_template_{phases,outcomes,custom_fields,narratives}` all name `template_version_id`; `cases` names `template_version_id`; `process_templates` inserts only identity columns; the version insert carries `status='published'`, not `'active'`. The earlier breakage is repaired.
- **Dropped-identifier sweep.** 338 hits triaged across `src/`, `e2e/`, `seed.sql`, `demo/*` for all six dropped identifiers (`cases.template_id`, `process_templates.status`, the four child `template_id` columns, the `'active'` value). Every surviving `template_id` resolves against `process_template_versions.template_id` (legitimate) or is a `p_template_id` parameter genuinely taking an identity. **Every** template-cluster embed used in `src/` was then verified against live PostgREST: seven resolve, one does not (F-1).

---

## 6. What I could not verify, and why

- **The full E2E gate was not re-run** (instructed; ~18–40 min, green at this HEAD). I verified instead that **zero** `src/` or `supabase/migrations/` files changed after the green commit, which makes the run valid evidence for the application code at HEAD. The spec-file change after it is F-7.
- **`npm run test:db` and `npm run test` were not re-run.** The pgTAP and Vitest figures (158 files / 4,860 tests; 945 unit) are taken from the record. I audited the *content* of `296` and `297` directly, which is the part a re-run would not tell me.
- **The `ARM=floor` and `ARM=census` sweeps were not re-run.** I confirmed the `ARM=policy` result independently by auditing the keystones' arms (§4), which is the claim most at risk of being vacuous. Note: I did not see `ARM=census` in the recorded evidence for either workstream — only `ARM=floor` and the diff-scoped `ARM=policy`. Per CLAUDE.md §6 step 1, `ARM=census` is the arm that catches a **brand-new** gate, which passes `ARM=policy` vacuously by being in no BLIND set. This phase added new gates. **Worth confirming before the human-approval step** — I flag it as an evidence question, not a finding, since I could not tell from the record whether it was run and not logged.
- **The backfill (`20260907000300`) could not be exercised**, and by ADR 0096 A1.3's own structural argument never can be locally: `db reset` applies migrations then `seed.sql`, so the backfill always runs against zero rows. The compensating measures (double invocation, raising post-conditions, `scripts/verify-tv-backfill.sh`, permanent invariant keystones) are the right design. **The rehearsal is mandatory and blocking before any `db push`** — that remains open and outside this review.
- **No `supabase db reset` was performed.** The shared local stack was left as found.

---

## 7. Required to clear this review

1. **F-1** — fix `src/lib/case-narratives/actions.ts:238` to the two-hop `process_template_versions(process_templates(commission_id))` (verified to resolve), matching the sibling at `:220-230` and the repaired modules at `process-templates/actions.ts:179`/`:814`.
2. **F-2** — add E2E coverage for template-narrative slot **edit** and **remove**, so the path that hid F-1 is no longer dark.

Recommended, not blocking: F-3 as a FUP with an owner and an explicit reachability acceptance; F-4 and F-5 as named coverage FUPs; F-7's scoped spec run; and an answer on `ARM=census` before human approval.

---

**Verdict: CHANGES REQUESTED**
