# Authorization Evolution — execution plan (ADR 0155)

- **Written:** 2026-08-26, at ADR 0155's acceptance. **Nothing in this plan is building**;
  live state is each unit's hub, listed in [docs/features/INDEX.md](../features/INDEX.md), never this file.
- **Amended:** 2026-08-27 — the [plan audit](../reviews/authz-evolution-plan-audit-2026-08-27.md)
  (CHANGES REQUESTED, findings F1–F18) was PO-ruled and folded in; ADR
  [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) carries the three 0155
  amendments (rollback artifact, catalog binding / authority-elect, pilot-cutline addition)
  and the four rulings. Corrections are tagged **`[PA-F#]`** in place (`PA-` because the
  original audit's F-numbers are already cited here bare).
- **Amended:** 2026-09-02 — the
  [implementation audit](../reviews/authz-evolution-implementation-audit-2026-09-02.md)
  (CHANGES REQUESTED, findings F1–F10, on `authz-ae4-catalog` at `a0b27f3c`) was analysed and
  its facts **reproduced on the live catalog the same day**; the PO adopted **Option A — make
  permissions real** (§ AE4.9). Corrections are tagged **`[IA-F#]`** in place. **The amending
  ADR is [0176](../decisions/0176-authz-permission-layer-made-real.md)** (`Amends:` 0155 D7 +
  0174) — the ruling binds through it, not through this plan (authority order below). As built,
  AE4.6 does **not** satisfy D7's "cut … over to the resolver"; § AE4.9 is the correction path.
- **Authorities, in precedence order:**
  1. **ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)**
     — the decisions (D0–D10) and the eleven PO rulings (G1–G11). Where this plan conflicts with
     the ADR, **the ADR wins and this plan must be corrected**, not silently obeyed.
  2. **This plan** — execution detail: tasks, order, gates, traps.
  3. The **[audit](../design/authorization-model-evolution-audit-2026-08-26.md)** — the analysis
     input (findings F1–F9, §7 phase sketches, §8 decision/test matrix). Analysis, not authority.
  4. The **[plan audit](../reviews/authz-evolution-plan-audit-2026-08-27.md)** (2026-08-27) —
     execution-plan review, CHANGES REQUESTED; cited here as `[PA-F#]`. Analysis, not
     authority — its dispositions bind through ADR 0162 and this plan's amended text.
  5. The **[implementation audit](../reviews/authz-evolution-implementation-audit-2026-09-02.md)**
     (2026-09-02) — built-state review of AE4, CHANGES REQUESTED; cited here as `[IA-F#]`.
     Analysis, not authority — its dispositions bind through ADR
     [0176](../decisions/0176-authz-permission-layer-made-real.md) and this plan's amended text.
- **Phase naming:** this plan's **AE0–AE7** map 1:1 to the ADR's "implementation Phases 0–7".
  The AE prefix exists so gate records and FUP lines never collide with AFF4's P/B/F/T tracks.
- **Pilot cutline (G1, amended by ADR 0162):** **AE0–AE4 gate the pilot. AE5 is post-pilot.
  AE6 is decided (record-only). AE7 is deferred (= D6).** One addition [PA-F12, PO
  2026-08-27]: **the tenant-boundary/PHI subset of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2)
  closes before Gate AE4's PO approval** — its own increment, never folded into AE1's or
  AE4's branch; the subset definition lives in the FUP.
- **Queue rule (G10):** AE0–AE1 may run in parallel with the standing pre-pilot queue;
  **C1a keeps its queue position** and this program never preempts it. If a session must choose
  between advancing this plan and running C1a, C1a wins.

---

## 0. Rules that bind every phase of this program

These are restated once here because every AE phase touches authorization surfaces; per-phase
sections only add what is specific.

1. **One phase at a time, through the full §6 gate** (CLAUDE.md §6): lint (the whole chain —
   ⛔ **verify its membership against `package.json`, never a count written here** [QA-AE3-r3 B8];
   this said "all ten" while the chain had grown to eleven), typecheck,
   vitest, pgTAP on a **fresh `supabase db reset`**, the ARM gates — `ARM=census`, `ARM=hat`,
   `ARM=floor`, `FROMFINDINGS=1 ARM=wrapper` — and, **whenever a phase touches any RLS policy or
   `prosecdef` gate** (that is: every phase of this program except pure-docs steps), the
   **diff-scoped door sweep** derived by `scripts/door-sweep-cases.sh`, never by hand. Its exit 1
   is a finding to rule on, never a pass. `ARM=census` is the arm that catches a gate you just
   added; a brand-new gate passes `ARM=policy` vacuously.
2. **Name the ARM, never the script**, in every gate record (§6 step 5) — and state the
   **structurally uncovered population beside the covered one** [PA-F12]: the reachable
   command doors of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2) are outside every arm's domain
   until that FUP closes, so "all arms green" never appears without its domain qualifier.
   ⛔ **This rule states no FIGURE for that population, deliberately** [QA-AE3-r3 B8]. It read
   *"the 407 reachable command doors"* from 2026-08-27 until 2026-08-31, by which point the live
   count was **427** — a rule *about* stating an uncovered population, teaching from a stale
   number, in the document that governs the phases doing the stating. `ARM=census`'s banner now
   **derives** the count each run from the predicate that defines the class; cite the banner or
   the FUP, never a figure typed here.
   ⭐ **Amended 2026-08-31 (ADR 0171):** an instrument that CAN measure this population now exists
   — `supabase/tests/mutation/c2-command-door-neutralizer.sh`. ⛔ **The rule above is unchanged by
   it**: the neutralizer is a separate periodic harness, **not an ARM**, so "all arms green" still
   never appears without its domain qualifier. ⚠ And the qualifier's *wording* must change — the
   class may no longer be called **"covered-but-unpinned"** (a 2026-08-17 3-door sample); the
   neutralizer found **3 BLIND** in its first 8 measurements.
3. **Catalog is truth** for any schema/RLS/RPC question — `pg_proc` (incl. `prosecdef`),
   `pg_policies`, ACLs. Never graphify it, never grep migration files and believe them. Strip
   `--` comments before any `prosrc` regex; probe helper names **unanchored** (`X` / `X_for`
   pairs: policies call the bare form, functions call `_for` — no single regex finds both).
4. **Every new door inherits every sibling arm whose domain its own shape puts it in** — derived
   per function from the catalog, ⛔ never a hand-list, never inferred from the batch's label. The
   arms bound on **client-reachability**, so the shape decides. A `public` DEFINER door holding
   `authenticated` EXECUTE takes the full set: census domain, hat, floor allowlist ruling, wrapper,
   door-SQLSTATE gate (ADR 0156: the domain is structural, not a name list). A `service_role`-only
   command door returning `void`/`uuid` — rule 2's C2 / `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` class —
   is **outside `floor`, `wrapper`, `census` and `policy` by construction**, which is neither a gap
   to fix in the arms nor coverage: ⛔ absence of a verdict here IS absence of coverage. That shape
   obliges a different discharge (AE1.3 §10.1, shipped): the **authority decision** moves into a
   swept object — a `bool`, `can_`-named `app` predicate census/policy do contain — the door stays a
   thin `public.*_for` wrapper over an `app.*_impl` VOLATILE kernel so the ADR 0156 gate sweeps
   both, `ARM=hat` covers all of them (its domain carries no privilege term), and the compensating
   controls are **named per door**, with any `ERROR` ruled against a control that itself carries
   verdicts — never against an assumption. ⚠ **A `REVOKE` moves a door between domains:** dropping
   `authenticated` EXECUTE can push one out of `floor` into exactly that blind shape, so partition
   every revoke batch by **post-revoke** domain membership before writing it
   (`docs/design/authz-definer-classification-ae1.md` §RV0). A door absent from the findings passes
   `ARM=wrapper` vacuously. Measured instance: `docs/plans/authz-ae1-person-doors.md` §10 F-F.
5. **Fresh reset before verdicts.** `ARM=floor` reads 35 phantom doors on a stale DB and 0 on a
   fresh one; pgTAP commission counts red spuriously after E2E. A green baseline on a mutated DB
   is not fit to mutate.
6. **Branch discipline:** one feature branch per AE phase, named `authz-ae<N>-<slug>`. On any
   parallel branch appearing, **the incoming side renumbers** (ADR numbers, migration timestamps,
   pgTAP file numbers, citations included). Take the next ADR number from
   `docs/decisions/INDEX.md`, never by eyeballing.
7. **Shared local stack has one owner at a time.** A `db reset` lands silently in another
   session's evidence; Playwright's webServer holds DB connections and half-applies resets.
   Announce resets in the active unit's hub (`## Current state`, [docs/features/INDEX.md](../features/INDEX.md)) while a phase is in test.
8. **Migrations:** no top-level `SET LOCAL` (use one `do $$` block; `lint:set-local`'s watermark
   is never bumped to pass). Data-dependent backfills match zero rows on a fresh local reset by
   design — that is not evidence they work; the remote push is where they do their real work, and
   the push order is **schema first, then code** (the AFF4 Record step recorded a violation of
   exactly this).
9. **PROGRESS.md discipline:** every task start/finish, bug, gate step, and PO ruling is written
   there when it happens. Completed material rotates at the Record step in the same edit
   (`npm run lint:progress` is the authority).
10. **Seed limits:** ⛔ no seeded persona holds anything outside its home org — **there is no
    cross-org persona**. Any differential or deny test that needs a cross-org actor must create
    one in its own fixture (and delete by identity, never positionally — positional cleanup eats
    seed rows other suites contractually depend on).
11. **E2E gate:** full suite green means **`npm run e2e:prod`** (batched, server-restart per
    batch), compared against the **named-flake** baseline (`FUP-E2E-REPEAT-FLAKY` names), not a
    count — a total that matches is not a list that matches. The two pre-existing flakes are a
    floor, not a guarantee. ⚠ **A name match is not a cause match [PA-F16]:** each baseline
    entry carries an **error fingerprint** (message/step pattern) plus an owner and an expiry;
    a name-matched failure with a novel fingerprint is a red, not a flake. An authorization
    phase never calls a run green while a relevant covered spec failed for an unverified
    reason.

---

## Phase AE0 — Baseline and attributable measurement

**Purpose:** every later phase must be able to say "this regression is mine / not mine". AE0
buys that. **No schema changes.** May run in parallel with C1a (rule G10) and with AE1's
preflight reads.

| # | Task | Owner | Detail |
| --- | --- | --- | --- |
| AE0.1 | **Catalog census, recorded with predicates** | backend | Re-run the ADR's Measured-figures queries against local **and** the linked remote (read-only), at the then-current migration head. Every figure lands with its deriving query beside it (the backend-state.md § REMOTE CENSUS convention). Includes: policy count; role-helper-calling policies (state the regex — the ADR's 131 used a broader family than the audit's 117; the number is predicate-dependent and both are honest only with the predicate attached); direct-`memberships` policies; comment-stripped functions reading `memberships`; DEFINER counts and `authenticated`/`anon` effective EXECUTE; `commission_administrativos` FK census; the withheld-column grants. |
| AE0.2 | **`EXPLAIN (ANALYZE, BUFFERS)` baselines** | backend | The named hot paths: session-context RPC; case list (`cases` under `_case_caps`); meeting list; commission dashboard aggregates; person roster (`listOrgUsers` / `listHospitalUsers` predicates); one grant + one revoke door. Run on a fresh reset, three repetitions, keep the plans (not just timings) in `docs/design/authz-evolution-baselines-ae0.md`. ⚠ Local, seed-sized data — these baselines detect **plan-shape regressions** (index → seq scan, InitPlan → per-row), not production latency; say so in the file header. |
| AE0.3 | **Local/remote parity check** | backend | `supabase migration list --linked` vs local head; both advisors (security + performance) on the linked project; any local-only or remote-only finding is explained in writing or the phase does not close. |
| AE0.4 | **Service-role DML sweep re-run** | backend | Re-derive the 12-site raw-DML census (measured 2026-08-26: five `profiles` + four `professional_credentials` writes in `src/lib/users/actions.ts`, one self-scoped `profiles` write in `src/lib/auth/actions.ts`, two `meeting_minutes_jobs` writes in `src/lib/minutes-jobs/{sweep,reconcile}.ts`) — line numbers drift; the **census query is the artifact**, committed as a script or documented grep so AE1.4's registry can be re-derived, never hand-maintained. Include `.rpc()` sites split actor-validating vs not, Storage writes, Auth-admin writes. |
| AE0.5 | **Persona/authorization matrix skeleton** | lead + PO | ✅ **DONE + PO-APPROVED 2026-08-26 → [axes](../design/authz-persona-matrix-axes-ae0.md).** ⛔ **This row read "persona × role × active-context × scope × operation" — FIVE axes — while attributing the grid to the audit's Phase 0, which asks for SEVEN.** Corrected: the grid is persona × role × active-context × scope × operation × **resource lifecycle** × **sensitivity**, seeded from `supabase/seed.sql`'s roster. The two dropped axes are load-bearing — AE4.1's `authz.permissions` carries `risk_class` **and** `sensitivity_ceiling`, and the audit's §8 requires a lifecycle/sensitivity-ceiling test per permission. This is the *shape* AE4.3 fills per role; AE0 only builds and PO-approves the axes, so per-role matrices are comparable. |

**Gate AE0:** all four ARM arms green on a fresh reset (this is also the "do not trust pre-2026-08-24
authz results" residue being re-established on current main); no unexplained local/remote drift;
baseline docs committed. No QA review needed (measurement-only), but the lead records the gate in
PROGRESS.md.

**Traps:** the census must not be run while another session's E2E is mutating the stack (rule 7);
`pg_stat`-style residuals are not counts; an instrument that creates what it counts (your own
shell spawning the processes/connections you then measure) — re-sample before recording.

---

## Phase AE1 — Integrity and privilege hardening (ADR D9)

**Purpose:** close the debt that is independent of the catalog, so AE4's differential oracle runs
against a clean floor. Backend-owned; frontend untouched; tester adds E2E only where behavior
changes (AE1.3).

**Slicing [PA-F18]:** AE1 lands as **independently mergeable increments** (FKs · DEFINER
review/revokes · doors · registry · initplan · zero-policy), each attributable under its own
gate subset; the phase gate closes over the last increment. AE1's sizing was drawn from the
12-site raw-DML census and is **resized against 45 sites** (AE0 F-AE0-3) [PA-F10].

### AE1.1 — `commission_administrativos` FKs (F7)

1. Orphan preflight (read-only, both stacks): rows whose `commission_id` has no `commissions`
   row; rows whose `user_id` has no `profiles` row. Record counts.
2. Repair deliberately (a decision per orphan class, not a blanket delete) — expected zero
   locally; if the remote shows orphans, that is a PO-visible finding first.
3. Migration: add both FKs `NOT VALID`, then `VALIDATE CONSTRAINT` — the production-safe
   sequence — with explicit `ON DELETE` behavior chosen and stated (default expectation:
   `CASCADE` for `commission_id` matching the platform's tenancy cascade posture, `CASCADE` for
   `user_id` only if the person-erasure story already cascades siblings; **derive from how the
   sibling appointment table behaves, do not guess** — and remember the cascade-closure lesson: a
   write lockdown is defeated by its parent, so check what these FKs newly make deletable).
4. pgTAP: FK presence by name + a rejected-orphan insert each.
5. **Supporting indexes [PA-F15]:** PostgreSQL does not index referencing columns; a cascade
   from `profiles(id)` full-scans this table if `user_id` has no supporting index. Inspect
   `pg_index` for prefix-compatible indexes on **both** referencing paths, add only what is
   missing, assert presence in pgTAP, and keep parent-delete cascade plan evidence. ⚠ AE1.1
   shipped before this amendment (committed `14ad668d`): the index verification lands as a
   **follow-up increment inside AE1**, not a rewrite of the landed migration.

### AE1.2 — DEFINER classification and the privilege budget (F5)

1. Enumerate every `authenticated`-executable DEFINER in `public` + `app` (AE0.1's census is the
   input). Classify each: **command door** (needs EXECUTE), **policy predicate** (needs EXECUTE —
   RLS evaluates as the caller), **trigger body** (needs none), **internal helper** (needs none).
   The classification lands as a committed artifact (table: function → class → verdict), because
   it is also AE4's wrapper inventory input.
   ⚠ **Classification is not security review — the review is TIERED [PA-F11; PO 2026-08-27,
   ADR 0162]. Tier 1** — remotely reachable functions (exposed schema per `config.toml` +
   `authenticated`/`anon` effective EXECUTE) — gets full threat-review columns: owning role +
   `BYPASSRLS` effect · PostgREST exposure · caller-identity binding · arbitrary-principal
   parameters · authority-before-existence ordering · overload/default-argument reach ·
   dynamic SQL + `search_path`/qualified references · output minimization & enumeration
   behavior · audit emission · exact grants (`PUBLIC`/`anon`/`authenticated`/`service_role`).
   Public command doors are **individually justified**. **Tier 2** — `app`-schema functions,
   where `anon` holds no USAGE (boundary = `config.toml`'s exposed-schema line, the
   `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` boundary) — keeps the four-way
   classification plus exact grants only.
   ⛔ **RUN 2026-08-27, and the tiering does NOT inherit step 1's population — that trap fired
   once already.** Step 1 enumerates `authenticated`-executable **DEFINERs**; PA-F11's Tier 1
   says *remotely reachable*, which says nothing about DEFINER. Taking the intersection gives
   **432** and drops **91** — 90 `public` INVOKER functions plus `graphql_public.graphql` —
   i.e. exactly the class ADR 0079 **Amendment 7** exists for: a `public` INVOKER wrapper whose
   own probe is the only gate in front of an `app` DEFINER body, in no arm's domain at all.
   **Tier 1 is 523.** Instrument: `scripts/authz-tier1-threat-review-ae1.sql`; review +
   findings: [authz-ae1-tier1-threat-review.md](../design/authz-ae1-tier1-threat-review.md).
   ⚠ **And the columns are computed over the CALL CLOSURE, never per body** — per body, the
   arbitrary-principal column reads 27 findings that are all two-line delegators; over the
   closure it reads zero. A per-row hand pass would have written those 27 down.
2. Revoke EXECUTE where the classification says so — **in batches with a full pgTAP + e2e:prod
   run per batch**, because a REVOKE you are not entitled to make is a silent no-op and an
   over-revoke surfaces as user-facing 42501s, not test failures, unless the suites exercise the
   path. ⚠ A revoke that "worked" locally must be re-verified on the remote after push (grants
   drift independently).
3. Explicit `ALTER DEFAULT PRIVILEGES` — ⛔ **the GLOBAL form, per actual creator role, never
   the `IN SCHEMA` form [PA-F4]:** `alter default privileges for role <creator> revoke execute
   on functions from public;`. PostgreSQL documents that a schema-scoped revoke **cannot
   remove the built-in global PUBLIC EXECUTE default** — the `IN SCHEMA` command succeeds and
   changes nothing. Enumerate the actual creator roles from the catalog (function owners),
   one command each; this covers `public`, `app`, and `authz` when AE4 creates it.
   **Positive control, mandatory:** after the change, create a probe function per creator
   role and assert effective EXECUTE via `has_function_privilege` (false for `PUBLIC`/`anon`,
   true only for intended roles) and inspect `pg_default_acl` — never infer success from
   command exit status.
   ⛔ **Step KEPT, justification REPLACED — ADR [0160](../decisions/0160-ae0-corrections-to-adr-0155-measured-figures.md).**
   This read *"This stops the 167→237 `anon`-residue growth at its source"*. Measured 2026-08-26
   on both stacks at head `20261003004300`: **there was no growth.** 167 (DEFINER-only) + 70
   (INVOKER-only) = **237** (all `app` functions `anon` may EXECUTE) — two *predicates* at one
   instant, not a before/after; and `anon` holds **no USAGE on `app`**, so the residue is inert at
   the schema level anyway. The step stays on its own merits: it makes the absence of PUBLIC
   EXECUTE a **declared property** of the schema instead of a fact that happens to hold, and AE4's
   new `authz` schema can set it once, before any object exists, at zero cost. ⚠ It is **not**
   remediation of a trend — do not re-import that framing.
4. ⚠ **The `anon` residue itself** (237 `app` functions, bounded only by
   `config.toml`'s exposed-schema line) is `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` and
   is a **PO decision, not a patch** — AE1 prepares the enumeration and the default-privilege
   stop; the historical-residue revoke sweep executes only under that FUP's ruling. Do not
   smuggle it into a feature migration.
5. Track the reachable-definer count as a budget line in `docs/backend-state.md`; the AE1 Record
   step writes the starting value **plus a ceiling and a merge rule [PA-F11]: no increment may
   raise the count without a named justification in its gate record, and the ceiling moves
   only by PO ruling.** A recorded number with neither is inventory, not a budget.

### AE1.3 — The nine person-authority door conversions (G11)

Convert the raw service-role writes to actor-validating doors. The class and semantics already
exist — this is deliberate pattern application, not design:

| Site (measured 2026-08-26; re-derive lines via AE0.4) | New door | Authority it must re-derive in SQL |
| --- | --- | --- |
| invite-flow `profiles` patch (`users/actions.ts`) | `finalize_invited_person_for` | inviter's admin authority over the target's intended footprint |
| person-fields `profiles` update | `update_person_fields_for` | ADR 0133 **INTERSECTION** (fields) |
| CPF change (same site, `cpf_change` capability) | same door, distinct capability arm | ADR 0133 **SUBSET** |
| deactivate / reactivate / suspend (`profiles.is_active`, `suspended_until`) | `set_person_active_for` / `suspend_person_for` | ADR 0133 **SUBSET** (lifecycle) — this is the platform kill switch; the door, not TS, must be the authority |
| credentials insert ×2 / update / delete (`professional_credentials`) | `upsert_credential_for` / `delete_credential_for` | ADR 0133 **INTERSECTION** (credentials) |

Requirements per door:

- Takes `p_actor uuid`; re-derives authority in PostgreSQL. **The SQL predicate is derived from
  `personScopeAllows` (`src/lib/users/person-scope.ts`) — the TS and SQL halves must be
  mirrored deliberately** and the pgTAP suite asserts the SQL half per capability × footprint
  case (spanning-person included: INTERSECTION admits a person whose footprint *intersects*,
  SUBSET only one wholly inside).
- Authored SQLSTATEs in the `HC0*` family (take the next free codes; ADR 0135 posture: never
  raise P-class — `FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL` is the live warning), authority
  checked **before** existence so a probe cannot enumerate.
- Exactly-once, PHI-free audit event each (Rule 11).
- Keystones **mutation-proven**: neutralize the door's authority check → the test must go red;
  assert the edit landed before trusting the rerun (a mutation that did not fully apply reports
  green). Prove the rollback moves the hash back.
- **Rule 4 above, in its C2 form** — these doors are `service_role`-only, so they sit **outside
  `floor`, `wrapper`, `census` and `policy` by construction**; what lands in the same migration set
  is the coverage they *can* carry: the door-SQLSTATE gate over every `*_for` wrapper and
  `*_impl` kernel, `ARM=hat` over both, and `ARM=census`/`policy` over the `bool` authority
  predicate they delegate to. ⛔ "no arm reds" is not a verdict here (§10 F-F of
  `docs/plans/authz-ae1-person-doors.md`).
- App side: `users/actions.ts` call sites switch from raw `.from(...)` DML to `.rpc(...)`; the
  TS guard **stays** (defense in depth + friendlier pt-BR errors) but is no longer the
  authority. Tester re-runs the person-admin E2E specs; expected diff: none user-visible.

**Deliberately NOT converted (manifested in AE1.4 instead):** the self-scoped
`must_change_password` write (actor = subject by construction; converting it adds a door with no
second principal) and the `meeting_minutes_jobs` webhook/cron writes (system actor — a
person-actor door would fabricate an actor). If a later finding shows the minutes paths need
integrity protection, that is a *system-actor door* design question for its own ADR, not a
retrofit here.

### AE1.4 — The service-role DML registry

1. New committed doc `docs/backend-state.md` § "Service-role DML registry" (or a dedicated file
   the section links): **every** service-role write target — table DML, `.rpc()`, Storage, Auth
   admin — one row each: owner · reason · revalidation mechanism (door name, or "self-scoped by
   construction", or "system actor: <invariant>") · audit event · the test that would notice its
   guard vanish. AE0.4's census script is the deriver; the registry is re-derived, and a diff
   between derivation and registry is a red.
   **Sized at 45 sites [PA-F10]** (AE0 F-AE0-3: 12 raw DML + 19 `.rpc()` + 6 Storage + 4
   `createSignedUploadUrl` capability mints + 4 Auth-admin), **machine-readable and diffed
   against the census script's output by a check, not by hand**. Census *completeness* and
   authorization *disposition* are separate columns: a row may carry `undecided` during the
   phase, but AE1 does not close with one — the **11 undecidable `.rpc()` sites** (4
   document-workflow, 4 minutes-job lifecycle, `list_stale_meeting_audio`,
   `get_feature_flags`, `lookup_printed_document`) are a **PO ruling** (row in the decision
   table below). An `undecided` registry row documents a bypass; it does not close one.
2. Extend `scripts/check-memberships-door.mjs`'s `GATED_TABLES` with `profiles` and
   `professional_credentials` **after** AE1.3 lands, with a named allowlist entry for the
   self-scoped `must_change_password` site (the gate's empty allowlist gains its first, reasoned
   member). ⚠ The gate stays table-name-based and client-blind — the registry, not the gate, is
   the closing instrument; the gate is a tripwire for the two conversions regressing.

### AE1.5 — RLS initplan / permissive-policy triage (F8)

1. From AE0.3's advisor output: rank the initplan warnings by table read frequency (the hot set
   is roughly: `cases`, `case_*`, `meetings`, `responses`, `memberships`-adjacent, roster
   tables). Fix only the measured-hot subset this phase: wrap row-independent calls as
   `( SELECT auth.uid() )` / `( SELECT app.fn() )` **where semantically valid** (a
   caller-dependent function must not be hoisted across a lateral boundary; when in doubt,
   leave it and record why).
2. Consolidate multiple-permissive-policy warnings **only where the policies are provably
   equivalent-intent** — ⚠ permissive policies OR together, so merging changes nothing
   semantically only if the merged predicate is the exact disjunction; anything else is an authz
   change and belongs to its own decision. Expect to consolidate few.
3. Every policy edit here triggers **rule 1's diff-scoped door sweep** and re-runs AE0.2's
   EXPLAIN baselines for the touched tables — the before/after plan diff is the acceptance
   evidence, not the advisor's warning count.

### AE1.6 — Zero-policy tables recorded

The security advisor's RLS-enabled-no-policy findings: record each as **door-only /
default-deny by design** in `docs/backend-state.md`, each with an exact-ACL pgTAP assertion
(SELECT/INSERT/UPDATE/DELETE all refused for `authenticated`), so an accidental future policy
or grant reds a test instead of silently widening.

**Gate AE1:** full §6 gate; diff-scoped door sweep over every touched policy/gate; **each new door
recorded against the arms its own shape puts it in, with the excluded arms named and no `ERROR`
left standing as a verdict** (rule 4) — for AE1.3's **six** `service_role`-only command doors (the
"nine" is nine *conversions*, not nine doors) that is `ARM=hat` plus the ADR 0156 door-SQLSTATE
gate over every `*_for` wrapper and `*_impl` kernel; `ARM=census` over `app.can_administer_person_for`
with its `ERROR run-shape!=baseline` ruled against a compensating control that itself carries
verdicts; and that control — the targeted AE1.3 mutation audit — at **16/16 with run shapes
captured**, not 14/16; registry derivation clean **with zero
`undecided` dispositions — the 11 `.rpc()` sites PO-ruled [PA-F10]**; the tiered DEFINER
review complete with the budget's ceiling recorded [PA-F11]; the default-privilege positive
controls green [PA-F4]; FK supporting indexes asserted [PA-F15]; the six `TO public`
process-template policies normalized or explicitly ruled (AE0 F-AE0-4); `e2e:prod` green
against the named-flake baseline **with fingerprints [PA-F16]**; QA review (`docs/reviews/`);
PO approval; Record step (rotation + backend-state.md update + budget line).

**Traps:** the invite flow writes `auth` + `profiles` + `professional_credentials` in sequence —
converting its middle write changes failure-ordering; the E2E invite spec must assert the
partial-failure path, not only success. TRUNCATE fires no DELETE trigger (don't "clean up" test
data that way). A guard that reads right can fail open — NULL `proacl` includes PUBLIC; assert
ACLs positively.

---

## Phase AE2 — Affiliation/person-tenancy split completion (ADR D8 + D3; `FUP-AFF4-HOMEORG-PHASE2`)

**Purpose:** every remaining visibility/containment decision moves off
`profiles.home_organization_id` onto the affiliation substrate; the column is demoted; the
affiliation ≠ authorization rule becomes binding text. **This phase closes
`FUP-AFF4-HOMEORG-PHASE2` and is the clause 0155 amends 0151 for — it is pre-pilot.**

### AE2.0 — PO decision first: lifecycle authority over fully-offboarded persons

✅ **RULED 2026-08-27 — option (a), last-org retention → ADR [0163](../decisions/0163-offboarded-person-lifecycle-authority.md).** AE2 migrations are unblocked. ⛔ **The question was the other way round from how this section states it:** not *should* offboarded persons be administrable, but **what replaces the authority AE2 deletes** — `authorizePersonScopedAdmin` (`src/lib/users/actions.ts:379-389`) resolves `home_organization_id` first and its org_admin arm grants with **no affiliation term at all**, so doing nothing is a **silent narrowing**, not a no-op. (b) and (c) were rejected as *premature, not wrong* — each owes a prior decision; see the ADR § Consequences.

0151 D10's open question, unchanged by 0155, and **it blocks AE2.3's design**: once a person's
last affiliation ends, *who may still administer them* (reactivate, correct CPF, see them in any
roster)? Options the lead prepares for ruling (with the AFF2 SUBSET bound as the frame):

- (a) **last-org retention**: admins of the org of the person's most recent ended affiliation
  keep SUBSET authority (continuity; keeps offboarded people reachable for corrections);
- (b) **platform-only**: fully-offboarded persons are administered only by `platform_admin`
  lifecycle authority (tightest; makes rehire flows heavier);
- (c) **time-boxed (a)** decaying to (b).

The ruling lands as its own short ADR (take the next number from INDEX.md), because it is a
standing authority rule, not an implementation detail. **No migration is written before it.**

### AE2.1 — Close the consumer set

Derive — as a property, never a hand list — every consumer of `home_organization_id`:

- `pg_policies` quals/with_checks (unanchored match);
- comment-stripped `prosrc` over `public` + `app` (the tenant containment trigger body included);
- app-side `.home_organization_id` references (`src/`), including the generated types row;
- `seed.sql` and pgTAP fixtures.

The census lands in the phase doc with counts per class. ⚠ The AFF4-era claim "the RLS legs and
the tenant trigger stay" names *classes*, not a count — the census is the count.

### AE2.2 — Migration design: per-leg re-predication

For each RLS leg: its replacement predicate on `organization_affiliations` (active rows; voided
excluded by definition; ended rows per AE2.0's ruling). For the containment trigger: re-derive
containment from an **active org affiliation** instead of the column. Each leg's change is written as
**old predicate → new predicate** in the migration's header comment so the differential (AE2.3)
has its per-leg contract.

⛔ **CORRECTED 2026-08-27 — this step named the WRONG FUNCTION, and read literally it was a
trap.** It said *"(the AFF4 D4 backstop is already SECURITY DEFINER per ADR 0159 — extend, don't
fork)"*. That sentence is **true, of a function this step does not touch**:
`app.assert_hospital_affiliation_has_org` is indeed `prosecdef = t`. **The trigger AE2.2 actually
re-predicates is `assert_profile_tenant_has_org`, and it is `prosecdef = f` — SECURITY INVOKER**
(catalog-measured). It is harmless *today* only because its body reads **no table at all** — a pure
NULL check on `new`. Giving it an `organization_affiliations` read makes it evaluate under the
caller's RLS against a policy that is
`principal_id = auth.uid() OR app.is_org_admin_of(organization_id)` — **no hospital tier, by
design** (ADR 0151 D1) — which is precisely the shape that shipped `BUG-D5-REHIRE-HOSPADMIN-001`,
breaking one-step rehire for **every** `hospital_admin` unconditionally (ADR 0159).
**Binding: the security context changes in the SAME migration that gives the trigger a table
read**, never as a follow-up, and AE2.3 must carry a `hospital_admin` containment-accept cell.
Census: [authz-ae2-home-org-consumer-census.md](../design/authz-ae2-home-org-consumer-census.md).

⚠ **Two sibling axes, one swept** (same census): `src/lib/queries/members.ts:243` still filters
`.eq('home_organization_id', organizationId)` — the predicate AFF4 B6a moved `listOrgUsers` off,
pinned by a regression test **for that one function only** — and its sibling door
`list_addable_commission_members` keys the same way with **no affiliation filter at all**, so a
fully-offboarded person is still listed as addable to a commission. Both are re-predication targets
here and differential cells in AE2.3; neither is authorized by ADR 0163.

### AE2.3 — The widening differential (the phase keystone)

Shadow old-vs-new for **person visibility**, per persona × target-person pair over the seed
roster **plus** constructed fixtures for the states the seed cannot reach (cross-org actor —
rule 10; fully-offboarded person; voided-only person; ended-but-not-voided person — construct
the state nobody constructed):

- **Every widening must be enumerated and approved [PA-F13]:** intended widenings exist by
  design (a person with active affiliations in two organizations becomes legitimately visible
  to both) and are **pre-declared as expected cells** in the differential; any widening not
  pre-declared = red. (0154's rule stands: narrowing can be wrong and safe; *unapproved*
  widening cannot.)
- **The differential covers writes and transitions, not only SELECT [PA-F13]:** per pair
  where applicable — SELECT · INSERT `WITH CHECK` · UPDATE old-row `USING` **and** new-row
  `WITH CHECK` · containment-trigger accept **and** reject · affiliation lifecycle
  transitions (end, void, last-affiliation termination racing an admin mutation, and AE2.0's
  chosen retention shape). The phase changes write containment; a read-only differential
  proves the wrong half.
- Newly *hidden* pairs are reviewed and either accepted (with the acceptance written) or fixed.
- The differential is a pgTAP suite that runs both predicates in one transaction — not two runs
  of the app — so it cannot be skewed by stack state; and it must be **proven able to fail**
  (temporarily widen one new leg → the suite must red) before its green is accepted.

### AE2.4 — Drop the column [PA-F14; PO 2026-08-27, ADR 0162 — demote-then-drop RETIRED]

After AE2.1's census reads zero live consumers: stop writing it on person creation, drop the
trigger-forced NOT NULL, and **drop the column in this same gated phase**. The retired
caution's premises did not survive review: old branches are not runtime consumers, generated
types regenerate, and a live stale tenancy column is *more* dangerous than a clean break —
future code can silently revive it as an authority source while every current test stays
green. Rollback SQL is retained **outside** the live migration chain (ADR 0162 §1's runbook
pattern). `npm run gen:types` after every migration (Rule 8).

⛔ **CORRECTED 2026-08-27 — "drop the trigger-forced NOT NULL" describes a constraint that does
not exist.** Catalog-measured: `profiles.home_organization_id` has **`attnotnull = f`** and **no
CHECK**. Enforcement is entirely `profiles_tenant_has_org_trg`, a **DEFERRABLE INITIALLY DEFERRED
constraint trigger**, and its rule is **conditional**: `if new.home_organization_id is null and
not new.is_admin then raise`. Admins may hold NULL, and one live row does. There is no NOT NULL to
drop; there is a trigger to re-predicate or retire.

⚖ **PO-RULED 2026-08-27 (T3) — the containment trigger is AE2.4's, not AE2.2's.** Measured by
backend at AE2.2 design time, the plan's AE2.2 instruction *"re-derive containment from an active
org affiliation"* is **not implementable in that step**, for two independent reasons:

1. **Two transactions, so deferral buys nothing.** `handle_new_user` inserts the `profiles` row
   inside GoTrue's `auth.users` transaction; the org affiliation is created only later, by
   `affiliate_person_impl` / `affiliate_person_to_org_impl`, in a **separate PostgREST
   transaction**. `DEFERRABLE INITIALLY DEFERRED` defers to the COMMIT of *that* transaction, not
   across both — so an active-affiliation predicate raises on **every signup, unconditionally**.
2. ⛔ **A circular dependency the AE2.1 census did not draw out.**
   `app.affiliate_person_to_org_impl` — the door that **creates** the org affiliation — is itself
   gated on the column (`if v_person_org is null or is distinct from p_organization then raise`,
   `HC0R0`). Containment cannot move onto affiliations while the affiliation-creating door
   requires the column. **Both halves must break in one move**, and that move is here.

The decisive reason it belongs to AE2.4 rather than being deferred to it: the trigger's body reads
`new.home_organization_id` **directly**, so dropping the column *forces* a rewrite of that function
regardless. Doing it in AE2.2 would rewrite the same function twice in one phase.

⛔ **Rejected outright, do not revisit (T1):** having `handle_new_user` also insert the org
affiliation so both are born in one transaction. `affiliate_person_to_org_impl` is idempotent on an
existing active row, so it returns early and **silently discards the caller's backdated
`p_started_on` and the `created_by` actor attribution** — a real product regression, and it
redesigns person creation inside a re-predication migration.

▶ **Candidate shape for this step (T2) — NOT yet ruled; it is a PO decision at AE2.4's design.**
Re-predicate containment to *"≥1 **non-voided** org affiliation"* (exactly ADR 0163's own
derivation domain — the persons who have a retaining org), drop the unsatisfiable `profiles`-INSERT
arm, and move enforcement to the only post-creation event that can destroy the invariant: a
deferred constraint trigger on `organization_affiliations` void/delete. It makes the invariant mean
*"this person is reachable by someone"*, which is what it is for.
⚠ **Its cost, stated:** creation-time containment is genuinely lost — a half-failed `createPerson`
leaves an **anchorless profile**, a window the column closes today. ⛔ That window is **inherent
once the column goes**, not something T2 introduces; enforcing it at creation instead requires T1,
which is rejected. The PO decides whether to accept the window or to design a third option.
⛔ **AE2.4's scope is FOUR items, not one — measured at AE2.3a, 2026-08-27.** The column has
**12 remaining function consumers** (catalog, comment-stripped) and dropping it forces every one:

1. **The containment trigger** — `assert_profile_tenant_has_org` (T2 candidate above; PO decision).
2. **`app.affiliate_person_to_org_impl`'s column gate** (`HC0R0`) — circular with (1), so both
   break in one move.
3. ⛔ **The WRITE-AUTHORITY path, and ADR [0163](../decisions/0163-offboarded-person-lifecycle-authority.md)
   IS HALF LIVE UNTIL IT LANDS.** `app.can_administer_person_for` still resolves
   `home_organization_id` (`prosrc` line 26), as do all six AE1.3 person-door kernels. AE2.2 moved
   the **read** side only, so 0163's retention — which its bound 1 scopes to exactly the **SUBSET**
   capabilities `lifecycle` and `cpf_change` — is **not in force where those capabilities are
   actually gated**. ⚠ **No seeded test can show this**: in `seed.sql` a person's home org and
   retaining org always coincide, so every seeded assertion is true under both predicates. They
   diverge only for a person anchored to org A whose active (or last non-voided ended) affiliation
   is in org B — constructed by pgTAP `392`, where it lands on **5 of 10** targets. **A
   capability-level differential over those diverging targets is a hard gate on the drop**;
   without it the drop silently *moves* write authority instead of preserving it.
4. **`listLinkableOrgUsers`** (C-a rejected, C-b′ recommended) — see `docs/progress/authz-ae2.md`.

Plus **AE2.3b**, the write/containment half of the differential, which T3 moved here: the plan's
warning *"the phase changes write containment; a read-only differential proves the wrong half"*
binds **AE2.4**, not AE2.2 — AE2.2 changed no write containment, so writing those cells there
would have asserted nothing.
⚖ **Increment status and two items ASSIGNED, 2026-08-28** (ADR
[0164](../decisions/0164-tenant-containment-moves-from-creation-time-to-the-destructive-event.md)):

- **Increment 1 ✅ landed** (`20261003005600`, suite `393`): containment re-predicated and moved to
  the destructive event; `assert_profile_tenant_has_org` flipped INVOKER→DEFINER with EXECUTE
  narrowed to owner, **in the same migration that gave it a table read**; **both** affiliate doors'
  `HC0R0` column gates re-expressed (the sibling was pulled in by lead ruling and its identity to
  the org-tier gate was **verified by diffing the live bodies**, not assumed); orphan detector with
  a three-way firing proof.
  ⛔ **The finding that changed a safety property.** The INVOKER keystone **survived** the first
  mutation, and the mechanism — measured, not theorised — is that **AE2.2 made profile visibility
  itself affiliation-derived**, so the trigger's blindness and the profile's blindness are
  **correlated**: it never reached the containment check, and an `if not found then return null`
  turned the whole regression into a **silent ACCEPT**. That is **fail-open**, the *opposite* of
  ADR 0159's predicted false-positive, and **invisible to an accept cell**. Fixed by making the
  trigger fail-closed. ⚠ Generalisable: a change that re-predicates one gate can invert the
  **failure mode** of another that reads through it.
- **Increment 2** — folded into 1 (the circular pair could not move separately).
- **Increment 3 ✅ landed** (`20261003005700`, suite `394`): `app.can_administer_person_for`
  re-predicated onto `app.person_authority_orgs` — **ADR 0163 is FULLY LIVE**, read *and* write.
  Its TS twin moved with **two sibling copies no increment's target list had named**
  (`authorizeForUser`, `getPersonAdminView` → `FUP-AE2-PERSON-PREAMBLE-THREE-COPIES`). Capability
  differential: **396 cells, 48 widenings all pre-declared, 44 narrowings each accepted**; 18
  subject-keyed mutations, both polarities, residual bound 9/42 declared in-suite. Gate: sweep
  **SWEPT 1 · COVERED 1 · BLIND 0**, four arms **0**, `test:db` **242f/8065**, lint 11/11.
  ⭐ **Closed an AE1 residue:** `can_administer_person_for`'s standing **`ERROR run-shape!=baseline`**
  — which Gate AE1 ruled against a *compensating control* rather than a verdict — re-measured
  **COVERED**. ⛔ It needed re-measuring anyway: **name unchanged, body changed**, so `ARM=census`
  (newcomers only) could not have noticed.
  ⚠ **Two corrections to ADR 0163 came out of building it**, both now in its Amendment 1: the
  SUBSET bound was a **hospital-tier label pinned to an org-tier rule** (retention is
  capability-**blind**; the ADR contradicted its own bound 3), and *"so do all six kernels"* was
  **true of the string, false of the grain** — their column read feeds `audit_write`'s
  `p_organization`, not authority. ⭐ Not cosmetic: `audit_log_select` gates commission-less rows on
  `is_org_admin_of(organization_id)`, so that value decides **audit-row readership** — a
  read-authority differential, handled by `app.person_audit_organization`.
  ⭐ **Generalisable:** *"function X names column Y" is a **census** result, not an **authority**
  claim.* This ADR promoted one to the other and it survived being written, reviewed and cited.
- ▶ **Increment 3** — the write-authority path (`app.can_administer_person_for` + the six AE1.3
  person-door kernels) with the capability-level differential. **Hard gate on the drop.**
  **ASSIGNED HERE:** `users/actions.ts:739`'s stale assertion (its file).
- ▶ **Increment 4** — `listLinkableOrgUsers`, shape C-b′ (C-a rejected).
  ⛔ **ASSIGNED HERE, previously in NO increment's target list:** **`resolveOrInviteUser`**
  (`src/lib/members/invite.ts:51`) resolves email→id, gates on `home_organization_id` with **no
  affiliation predicate**, and **auto-grants `staff_admin`**. It was in AE2.1's census but
  classified *service-role, structurally immune* — true for the **RLS-audience** question and
  **irrelevant to the column-drop question**, which is how it fell between both. ⚠ Two different
  properties were being tracked in one column.
- ▶ **Then the drop.** Its checklist (in `docs/progress/authz-ae2.md`) carries the stale assertions
  no gate can see: `handle_new_user`'s body comment, `invite.ts:35`, `e2e/phase13-audit.spec.ts:139`,
  and `docs/backend-state.md` 396 / 599 / 5674.

⚠ **Owed, not scheduled — a raw SQLSTATE now reaches a user.** Voiding a person's last non-voided
affiliation raises bare **`23514`**, and unlike ADR 0156's precedent **no path refuses earlier**.
It needs a mapped `HC0R*` in `void_org_affiliation`. Assign it before the drop.



### AE2.5 — D3: the binding text

- ARCHITECTURE.md gains the rule (verbatim direction from the ADR): **"Affiliations
  (`hospital_affiliations`, `organization_affiliations`) are visibility and lifecycle inputs.
  They NEVER grant capabilities; no policy or door may treat an affiliation row as a positive
  authorization source."** Placed with the numbered Architecture Rules so "Rule N" citation
  works.
- CLAUDE.md §1 already describes affiliation as a read-visibility input — check whether the new
  rule number belongs in the §3 index line; **ask the human before touching CLAUDE.md** (its own
  standing rule).

**Gate AE2:** the widening differential green **and mutation-proven**; diff-scoped door sweep
over every altered policy + the trigger; all four ARM arms; full §6; QA review; PO approval;
Record step closes `FUP-AFF4-HOMEORG-PHASE2` (index line + body rotate to the archive **in the
same edit**).

**Traps:** D11's lesson — after any predicate re-key, re-sweep `pg_policies` for stranded
references (a policy naming a dropped column fails at parse only when *evaluated*). The AFF4
backfill matched zero rows locally by design; AE2's re-predication instead **must** be
exercised locally (seed has 35 org-affiliation-backed persons — assert a floor, not exact
counts, per the catalog-driven-count lesson). `expires_at` on membership legs is **ruled out**
(0151 D6, `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` stays open on the PO's call) — AE2 must not
"helpfully" add it.

---

## Phase AE3 — Restricted personal-detail extraction (ADR D4)

**Purpose:** `cpf`, `date_of_birth`, `phone` move to `public.profile_private_details`;
column-level grants retire as a mechanism. **Single-shot (G2): one migration set, no dual-write.**

### AE3.1 — Reader/writer census (before any DDL)

Close the set of everything touching the three columns:

- SQL: comment-stripped `prosrc` sweep + `pg_policies` + view definitions + trigger bodies
  (`guard_profile_privileged_columns`'s identity half is a known member);
- app: every `.cpf` / `.date_of_birth` / `.phone` read off a `profiles` row (`src/`), the
  invite flow, `getPersonAdminView`, the CPF probe/audit path (`log_cpf_probe_for`,
  `list_org_people`'s per-call `person.cpf_lookup` audit — these keep working unchanged and
  their audit semantics must survive the move);
- types + zod schemas + E2E fixtures.

### AE3.2 — The migration set (one branch, one push)

1. `create table public.profile_private_details (profile_id uuid primary key references
   profiles(id) on delete cascade, cpf …, date_of_birth …, phone …, updated_at …)` — CPF CHECK
   and uniqueness semantics **moved, not re-invented** (same expressions; the unique index moves
   with its collation/normalization intact).
2. `alter table … enable row level security` **in the same statement block as creation**;
   revoke-all from `authenticated`/`anon`; **no direct-table policies for `authenticated`
   beyond self-read if the census shows the app needs it** — default expectation: the table is
   **door-only** (AE1.6's class), read via `get_own_person_record` (self) and
   `getPersonAdminView`'s door path (admin), written via AE1.3's doors (`update_person_fields_for`
   with the `cpf_change` arm). AE1.3 landing first is what makes AE3 small.
3. Backfill in the same set (`insert … select` from `profiles`), then in-migration verification
   `do $$` block — **primary proof: keyed per-row equality [PA-F2 — restores 0155 G2's
   row-hash requirement, which this step had dropped]:** join `profiles` ↔
   `profile_private_details` on `profile_id` and assert `IS NOT DISTINCT FROM` for all three
   columns, **raise on the first mismatch**. Counts and uniqueness pass value swaps, moved
   phones, and permutations among rows; keyed equality does not. A keyed hash is acceptable
   only if it includes `profile_id`, uses a stable canonical representation, and the raise
   message **never emits raw values** (no CPF in an error). Row-count parity, per-column null
   parity, and CPF uniqueness stay as secondary controls (a backfill masks the broken write
   path only if nothing asserts it).
4. Re-point every SQL consumer from AE3.1's census; drop the three columns; drop the identity
   half of `guard_profile_privileged_columns` (the lifecycle half stays).
5. `npm run gen:types`; app consumers re-pointed (Rule 9 — through `src/lib/queries/`, no
   inline supabase-js).
6. **Deployment shape [PA-F3] — an explicit maintenance-window cutover, written, not
   assumed:** stop the app (Coolify) → apply the migration set → deploy the re-pointed
   application → restart → smoke. Once the columns drop, the still-deployed old application
   fails on every `profiles.cpf`/`date_of_birth`/`phone` read or write — "pre-live" shrinks
   the audience, it does not make two deployment systems atomic, and G2 authorized a
   single-shot *data* migration, not an unplanned outage. The step names its rollback
   trigger: if the code deploy fails after the migration succeeded, apply the retained
   rollback SQL (ADR 0162 §1 pattern) or roll forward with a fixed build — decided in the
   runbook, not improvised.

### AE3.3 — Tests

- pgTAP matrix per access path: self · same-scope admin (INTERSECTION) · spanning-footprint
  admin · wrong-hospital admin · wrong-org admin (constructed persona — rule 10) · inactive
  actor · suspended actor · service-role orchestration (actor-validated door path).
- **Assert on `profile_private_details` itself** — it is reachable only through the predicates
  under test, which is exactly the anti-permissive-sibling shape the authz-handoff §7.1 lesson
  demands (`profiles` itself is hopeless for this: it carries broad `FOR ALL` policies).
- Keystones mutation-proven both directions: neutralize the admin door's footprint check → red;
  and the over-grant twin (wrong-org read) must be shown **able to fail** by temporarily
  granting.
- E2E: the person-edit and invite flows re-run; one keyboard-only pass on the CPF field
  (accessibility rule); the CPF-probe audit event still emitted exactly once.
- The D4 gate assertion from the ADR: raw restricted fields never appear in list / aggregate /
  session-context outputs — asserted as a **rendered-output / API-response property** over the
  roster and session endpoints, never a source grep (`ui-copy-forbidden-strings` rule: source
  cannot separate live copy from prose about it).

**Gate AE3:** full §6; diff-scoped sweep (policies + doors touched); QA review with an explicit
LGPD note (the extraction is the DSR pointer table now — link it from the DSR docs); PO
approval; Record.

**Traps:** ⚠ **the pilot boundary.** If real data has loaded before AE3 ships, **G2's single-shot
authorization is void** — the audit §7 Phase 3 dual-write contract binds instead, and the phase
re-plans. The lead checks PROGRESS.md § State's pilot row at AE3 branch-cut. Also: `.select('…')`
strings + `.maybeSingle<T>()` assertions are a wired seam vitest cannot see — the E2E pass, not
types, proves the re-pointed reads.

---

## Phase AE4 — The catalog, and `staff_admin` substituted end-to-end (ADR D7)

**Purpose:** the `authz` catalog exists, migration-managed; exactly one role — `staff_admin` —
runs on it, with the differential oracle and the re-pointed gate arms proving the mechanism.
This is the pilot gate's last phase (G1).

**Slicing [PA-F18]:** the non-runtime catalog substrate (AE4.1 + AE4.2, plus AE4.5's
generator tooling) lands and is tested as its **own mergeable increment before the cutover
increment** — it is inert until the wrappers delegate, and a failure inside a change set
that broad is otherwise unattributable. AE4.8 stays a parallel track inside the phase under
file ownership.

⛔ **As BUILT (audit 2026-09-02, reproduced on the live catalog) [IA-F1]:** `staff_admin` runs
on the **role half** of the catalog only. Both wrappers are one-liners over `authz.holds_role`,
which reads `assignment_facts` + `authz.roles.state` and **no permission**; the resolver
`authz.has_direct_permission` — the target D7 names — has **zero production callers**, and
`role_permissions` is read by nothing on the runtime path. Deleting the
`staff_admin → commission.forms.edit` grant flips the resolver and leaves the wrapper `true`;
setting the role to `legacy` does the opposite. Not a live exposure (`holds_role` is at least as
tight as legacy `has_role` and adds the state gate) — a **conformance** defect: the approved
matrix is not the oracle of what shipped. **Direction adopted 2026-09-02: Option A — § AE4.9.**

### AE4.1 — Schema (backend)

- `create schema authz` — **not** in `config.toml`'s exposed schemas; explicit default
  privileges (AE1.2's discipline) before any object.
- `authz.roles(code pk, allowed_scope_kind, system_managed, session_selectable)` ·
  `authz.permissions(code pk, resource_kind, risk_class, sensitivity_ceiling, assignable)` ·
  `authz.role_permissions(role_code fk, permission_code fk, applies_to_descendants)` ·
  `authz.permission_implications(implying fk, implied fk)`.
- **Integrity contract [PA-F5]:** `PRIMARY KEY (role_code, permission_code)` and
  `PRIMARY KEY (implying, implied)` on the two join tables; `CHECK (implying <> implied)`;
  `UNIQUE (code, allowed_scope_kind)` on `authz.roles` (the binding target below); the
  reverse-direction indexes the resolver's queries need; every state/classification column
  an enum/domain/CHECK, never free text. Acyclicity stays **migration-gate law** (the pgTAP
  recursive check), stated as such — not a trigger. ⚠ A column whose semantics are deferred
  to the §8-residue row (`sensitivity_ceiling` ordering, `applies_to_descendants`
  inheritance, `assignable`'s acting party) is either **not created yet** or created
  **CHECK-pinned to its single legal value** — a column only reports read is a label, not a
  control, and must not be able to hold undefined states.
  ⭐ **AS BUILT (Increment 1) — ADR [0172](../decisions/0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md), where this row is corrected rather than silently obeyed:**
  all three residue columns are **NOT CREATED**, because both join tables hold zero rows in
  this increment and a CHECK pinning a value no row holds is itself vacuous. `risk_class` IS
  created (PO override 2026-09-01) with a value set **proposed by the author, not derived** —
  no authority in this tree defines one. Every classification column is a **DOMAIN over
  `text`, never a native enum**: PostgreSQL has no `ALTER TYPE … DROP VALUE`, so an enum
  value set invented before its subjects exist is permanent, and AE5 will widen these
  vocabularies eleven times.
- **Assignment binding [PA-F1, ADR 0162 §2]:** the catalog replaces the legacy role/scope
  authorities only when something binds assignment storage to it — a CHECK cannot query
  another table, so `allowed_scope_kind` alone constrains nothing about a `memberships` row.
  In AE4, once AE4.2 seeds every role: `memberships` gains a carried `scope_kind`
  discriminator (consistent with the scope-exclusivity CHECK) plus the composite FK
  `(role, scope_kind) → authz.roles(code, allowed_scope_kind)`; the actual scope-column
  shape stays enforced independently of the role name. The legacy `memberships_role_check` +
  scope-shape CHECKs retire **only at AE5-complete**, when every role is `authoritative`.
  ⛔ Until that retirement the catalog is **authority-elect** — "the catalog is the
  authority" may not appear in a gate record before then.
  ⭐ **AS BUILT — the FK is `MATCH FULL`, and this row's silence on match type was a hole**
  (ADR 0172). Measured: under the default MATCH SIMPLE the composite FK is satisfied
  **vacuously whenever any referencing column is NULL** — a scratch-table row with
  `scope_kind = NULL` and `role = 'TOTALLY_FAKE_ROLE'` was **ACCEPTED**. ⚠ And its value is
  **prospective**: on the real `memberships` table the hole is unreachable because
  `memberships_role_check` / `memberships_scope_shape` reject first, so a keystone run there
  goes green while measuring a different control. MATCH FULL is what survives their
  retirement. `platform_admin` and `administrativo` carry **structurally unreachable**
  `allowed_scope_kind` values (`none` / `capability_plane`), which is what keeps
  `role = 'administrativo'` out of `memberships` **after** the CHECK retires.
- pgTAP: referential integrity; **implication acyclicity** (recursive check as a test, not a
  trigger); the PHI/write separation invariants as data tests — `…phi…` codes never implied by
  content-read codes, write codes never implied by read codes (the `_case_caps` separations,
  restated as catalog properties).
- Application roles get **no DML** on `authz.*`; `authenticated` gets SELECT only if the
  resolver needs invoker-context reads — default: no direct grants, resolver is DEFINER with
  pinned `search_path`.

### AE4.2 — Seed the identifiers, everything legacy

All ten current roles + `platform_admin` + the `administrativo` capability plane get catalog
rows (stable codes = the existing enum literals; `staff_admin` keeps its key — G-note in the
ADR); **zero** `role_permissions` rows except `staff_admin`'s (AE4.3). Role state tracking
(`legacy` / `test_validation` / `authoritative`) is a **column on `authz.roles`**, asserted by
pgTAP, so "which evaluator owns role X" is a catalog fact, not a code-reading exercise.

### AE4.3 — The `staff_admin` permission matrix (lead + backend, PO approves)

Derive the complete current behavior from **all planes**, each row sourced:

- the `memberships` CHECK + scope-shape row;
- every policy calling `is_staff_admin_of` (bare) and every function calling
  `is_staff_admin_of_for` (rule 3's pair trap — sweep both, unanchored);
  ⭐ **CORRECTED 2026-09-01 from the measured sweep (ADR 0172 increment; matrix
  [doc](../design/authz-ae43-staff-admin-permission-matrix.md) § 0) — the trap is real but this
  line's DIRECTION is false in BOTH halves.** Policies: **63 bare / 2 `_for`**. Functions:
  **151 bare / 27 `_for`**. Both planes are dominated by the **bare** form; functions do not
  "call `_for`" as a rule. ⛔ Keep the method lesson, which is the durable part: match the name
  **UNANCHORED ONCE** (the bare name is a prefix of `_for`, so one pass finds both) and then
  **classify** each hit — two anchored greps whose union is trusted yield correct totals and a
  **wrong classification**, and the classification is what says whether a site checks the caller
  or a third party.
- mutation doors whose bodies branch on the role;
- session partition (`session-grants.ts`), landing route (`page.tsx` + the `role-catalog.ts`
  mirror), action guards;
- E2E specs that encode `chefe.ccih@test.local` behavior.

Output: permission codes (`commission.forms.manage`, `commission.staff.manage`,
`commission.dashboard.read`, …) with the mapping row ↔ current enforcement site. **The PO
approves this matrix; from cutover it is the regression oracle** (not a retained shadow path).
⛔ **CORRECTED 2026-09-01 — `commission.forms.manage` is NOT VIABLE as a single code, so do not
generate cells against this line's worked example.** `authz.permissions.risk_class` is a
per-permission column, so **a code may not span a reversibility boundary**, and `.manage` bundles
reversible draft edits with the **irreversible** publish (`guard_published_version_trg`,
Architecture Rule 5). Codes split at that boundary — `commission.forms.edit` (`write`) +
`commission.forms.publish` (`irreversible`). The constraint is general: every `.manage` shorthand
in this plan needs the same check before AE4.5 enumerates it. Matrix
[doc](../design/authz-ae43-staff-admin-permission-matrix.md) § 8.

### AE4.4 — Adapter + resolver

- Read adapter projecting live `memberships` rows (and `profiles.is_admin`, and active-role
  context) into assignment facts — internal, `authz` schema.
- `authz.has_direct_permission(principal, scope_kind, scope_id, permission_code)` +
  `authz.explain_direct_permission(…)`. The explanation returns a **fixed composite type
  with an allowlisted set of typed fields — codes and ids only, never open-ended JSON
  [PA-F17]**: pgTAP asserts the **exact key/type set** (schema-positive), and the
  PHI-fixture string-negative check is a secondary control only (prove it can fail: point it
  at a deliberately chatty debug variant first — a denylist of fixture strings cannot see a
  newly added field or a transformed value). Direct EXECUTE restricted; AE4.3 decides
  whether explanation calls are themselves access-audited — under LGPD, codes and ids can be
  personal data even when they are not PHI.
- **Resolver shape [PA-F6]:** `STABLE` is a volatility promise, **not** a per-statement
  cache — a function whose arguments vary by protected row runs per row regardless. So:
  **implication closure is materialized at migration time** (rows are migration-managed; the
  same migration that edits `permission_implications` rebuilds the closure), making the
  runtime resolver non-recursive indexed lookups; the exact resolver SQL is written into the
  phase doc before cutover. The plan that rules out per-row recursive scope ancestry in AE7
  does not get to introduce per-row recursive permission implication here.
- **Performance evidence [PA-F6]:** AE0.2's seed-sized, statistics-free baselines cannot see
  this regression class. Before cutover: a **scaled, ANALYZEd fixture** (realistic
  membership / permission / resource cardinalities) with its **own** baseline — ⛔ never
  `ANALYZE` the AE0 comparison DB (the standing AE0 residue, recorded in
  [authz-ae0.md](../progress/authz-ae0.md)) — capturing **nested
  plans** for the protected query bodies, not only the outer RPC (AE0 §H: DEFINER paths show
  only an outer Function Scan otherwise), comparing loops / buffers / rows-removed / plan
  shape, with explicit per-hot-path regression thresholds. The wrappers keep their current
  call shape so AE0.2's plan-shape baselines stay comparable on the unscaled side.
- **Resolver corrections [IA-F3] — DO NOW, while callers = 0 (zero compatibility cost; the
  § AE4.9 "do now" list):** `p_scope_kind` is accepted and **ignored** (a commission id with
  kind `hospital` — or `banana` — still grants) → reject a kind that disagrees with the
  permission's `resolution_scope_kind`, fail closed; the resolver ignores `authz.roles.state`
  (correct for a candidate oracle, unsafe under a general name) → **split** a private candidate
  evaluator that may see `test_validation` from a runtime evaluator that requires
  `authoritative`; rename `has_direct_permission` → `has_permission` (it joins the implication
  closure — it answers *entailed*, not direct) and `explain_direct_permission` →
  `explain_permission`; `permission_explanation.denied_reason` is declared `text`, not the
  `authz.denial_reason` domain created beside it → use the domain; a deleted grant explains as
  `scope_unreachable` (reachability is computed only through rows that already grant) → add a
  distinct `permission_not_granted` and compute reachability independently of the permission
  join; `LIMIT 1` without `ORDER BY` → deterministic precedence, or every granting path.
- ⛔ **Performance evidence is ABSENT [IA-F9]** — no AE4.4 scaled-fixture artifact or acceptance
  exists anywhere in the record (2026-09-02: zero hits outside AE0.2's baselines).
  `assignment_facts` is a `SECURITY DEFINER` SQL set-returning function, which the planner does
  not inline, behind 63 policies. Measure the **final** path (after § AE4.9's seam), never
  `holds_role` in isolation — optimizing first makes the wrong seam faster.

### AE4.5 — The differential oracle (tester + backend)

One pgTAP suite, both evaluators, identical fixtures, every required cell:
`is(legacy(…), catalog(…))` per cell **plus** `is(catalog(…), <approved matrix value>)` — the
second half is what makes the matrix the oracle rather than "whatever legacy did".

- **The cell set is GENERATED, not hand-authored [PA-F7]:** the AE1.3 vector pattern
  (`scripts/gen-person-scope-vectors.mjs` → JSON vectors → pgTAP + vitest twins) applied to
  the seven PO-approved axes — a generator whose constraint rules **exclude impossible
  combinations as code**, stable cell IDs, generated/validated pgTAP vectors, a mapping from
  each permission to its current enforcement sites, and a coverage report
  (expected/executed/skipped) that **fails when any catalog permission, role, wrapper, or
  approved cell has no test mapping**. Deny classes (wrong-scope, cross-org constructed
  persona — rule 10, inactive, suspended, expired seat, wrong active context, recusal-class
  hard denies where staff_admin meets cases) are axis values in the generator, not prose —
  "exhaustive" is an output of the artifact, never a review adjective.
- **The diff rule, precise [PA-F8] — "zero-diff" language retired:** every observed
  legacy ≠ matrix difference is (a) **fixed in a preceding, independently gated increment**,
  (b) a **named compatibility exception** — first-class in the matrix, with owner and
  expiry, mutation-tested like any other cell — or (c) **blocks the cutover**. ⛔ The trap
  this replaces: with "catalog = legacy" and "catalog = approved matrix" both required, the
  cheapest green is to approve a legacy defect *into* the matrix — a known bug becomes the
  new system's regression oracle. Concretely: the open meeting-case recusal omission is
  dispositioned (a/b/c) **before** the `staff_admin` matrix is approved.

The suite must be shown able to fail (flip one seeded `role_permissions` row → reds). It is a
**pre-cutover artifact**; after cutover it collapses to the catalog-vs-matrix half.

⛔ **As BUILT [IA-F2]:** the generator's "every catalog permission has a mapping" and "every
non-legacy role has a suite" arms range over `spec.catalogPermissions ?? []` and
`spec.nonLegacyRoles ?? []`, and the axes input defines **neither** key — both pass having
checked nothing (the axes file records this about itself; recorded is not fixed). The pgTAP
permission→site mapping (401 §19) is a hand `CASE` whose `ELSE` sends **38 of 43** codes to
`is_staff_admin_of_for`, so a 44th permission inherits a default instead of forcing a decision;
the differential sweeps **three** representative codes with `operation` / `resourceLifecycle` /
`sensitivity` unswept (648 executed, 1152 skipped). **Do now:** populate both arms from the
catalog at generation time so they range over 43 and 1, not zero, and prove each can red.
**Under Option A (§ AE4.9):** the `CASE` is replaced by the generated **enforcement manifest with
no default arm** — set difference in either direction fails generation (`catalog − manifest`,
`manifest − catalog`, `authoritative roles − approved suites`).

### AE4.6 — Atomic cutover

- One migration: the `staff_admin` wrapper family's bodies delegate to the resolver
  (`create or replace` — names, signatures, `prosecdef`, ACLs unchanged; assert all four in
  pgTAP, the a-rename-orphans-a-name-keyed-verdict lesson).
- ⛔ **As BUILT, the bullet above is NOT what landed [IA-F1]:** `20261003007200` delegates to
  `authz.assignment_facts` — its own comment: *"DELEGATION TARGET: `authz.assignment_facts`,
  NOT a permission code. RULED 2026-09-01"* — and AE4.7b collapsed both wrappers onto
  `authz.holds_role`. That ruling exists **in the migration comment only**; no ADR carries it,
  and ADR 0174 is voiced `Relates:` 0155 D7, not `Amends:`. **The migration's argument is
  accepted:** a role wrapper (`is_staff_admin_of` asks *is this user a staff_admin here*)
  cannot be routed through a permission resolver — a sentinel code breaks on its own revoke, and
  "holds any staff_admin-granted permission" returns true for a plain `staff` the moment AE5
  grants an overlapping code. **The consequence is not re-pointing the wrappers; it is re-keying
  the enforcement sites** so each asks for the permission it actually guards — § AE4.9.
  `holds_role` stays as the **assignment-projection layer** and the transitional role predicate.
- Direct-call census: every `has_role(…, 'staff_admin')` / literal-`'staff_admin'` site outside
  the wrappers (SQL: comment-stripped; TS: the AE4.3 inventory) — each **replaced or
  allowlisted with a reason**, the census committed so a new bypass reds.
- `authz.roles.staff_admin` → `authoritative`; the legacy decision branch removed.
  **Rollback is a reviewed runbook + SQL template kept OUTSIDE `supabase/migrations`
  [PA-F9, ADR 0162 §1]** — a committed migration file is part of the ordered applied chain,
  so a "retained rollback migration" either undoes the cutover on the next apply or is not a
  repository artifact. Invoking rollback mints a **new** timestamped migration through the
  normal command, revalidates wrapper names/signatures/`prosecdef`/ACLs first, re-points the
  wrappers to the adapter **without deleting catalog data**, and records the event;
  code/database compatibility is stated in both directions. ⛔ Never `legacy OR new`; no
  caller-selectable evaluator — asserted by a
  pgTAP test that greps the *catalog* (comment-stripped `prosrc` of the wrapper family) for the
  legacy predicate's absence.
- ✅ **BUILT 2026-09-02 [IA-F10 CLOSED] — `docs/deployment/authz-rollback-runbook.md` + `authz-rollback-template.sql`.** ⚠ One NAMED GAP remains inside them: the worked example for the three AE4.9 D6 representatives (runbook §6), owed before Gate AE4. ⛔ The struck paragraph is retained for its REASONING (why out-of-chain), not its status:
- ~~⛔ **The rollback runbook + out-of-chain SQL template do NOT exist [IA-F10]**~~ (2026-09-02:
  zero files matching `*rollback*`; "out-of-chain" appears only in the audit). Owed before Gate
  AE4. The re-point target it describes is now `holds_role`, and after § AE4.9 it must also
  cover a re-keyed site (revert the domain authorizer to the role wrapper without deleting
  catalog data).

### AE4.7 — Gate re-pointing (G8 — merges block on this)

In the same increment: the census/hat/floor/wrapper domains re-derived so the delegating
wrappers stay in-domain; a **catalog-completeness arm** (every `authz.roles` row in
non-`legacy` state has an approved matrix file and a differential suite); a **wrapper-coverage
arm** (every enforcement site for the substituted role resolves through the wrapper family —
the AE4.6 census re-run); mutation arms re-pointed at the resolver (neutralize the resolver's
scope check → the staff_admin keystones red).

### AE4.8 — App-side seam collapse (frontend, parallel track, file-ownership clean)

The F1 payoff on the app side, mechanical and behavior-preserving:

- `role-catalog.ts` becomes the **single** role manifest: the six label maps collapse into
  `ROLE_LABELS` re-exports; the hand-mirrored `landingRouteForRole` and `page.tsx`'s precedence
  chain are re-derived from one ordered manifest (one array, two consumers) so a future role
  crosses **one** seam, not two;
- the session partition keys off the same manifest's scope declarations;
- **the TS manifest is BOUND to the DB catalog [PA-F1]:** the manifest's role codes and
  scope declarations are **generated from — or gate-checked against** — `authz.roles`
  (`code` / `allowed_scope_kind` / `session_selectable`), so the two cannot drift silently;
  the check runs in the lint/vitest gate, not in review;
- G4's selection-vocabulary move: `assume_role`'s validity check reads
  `authz.roles.session_selectable` instead of the TS enum list — the `platform_role` **DB enum
  stays** for now (its retirement is AE5-complete territory, ADR re-analysis trigger 4 — ⚠ and
  part of the AE5 bundle, § AE5). ⛔ **The in-flight "G4 is not implementable as written"
  ruling is SUPERSEDED 2026-09-02 [IA-F4]:** it read "typed query" as a *client-side* query into
  the sealed schema. `public.assume_role` is `SECURITY DEFINER`; it reads `authz.roles`
  server-side with **no new grant** to `anon` / `authenticated` / `service_role`. As built,
  `session_selectable` has **zero readers** in the catalog — flipping it changes nothing.
  **Do now:** enforce it inside `assume_role`; pgTAP proves a true→false mutation blocks
  selection while other roles still select; decide once whether selection also requires an
  allowed catalog `state`. The vitest key-set comparison stays as a **presentation-drift
  guard**, never as the enforcement.
- ⚠ **`role-catalog.test.ts` is non-hermetic [IA-F7]:** it `execFileSync`s into the Docker
  database during vitest, so it compares checked-out TypeScript to whatever schema the last
  reset or bisect left (the exact stale-catalog class behind this phase's retracted diagnosis).
  **Do now:** move the live-catalog binding to a DB gate that runs after a fresh reset, or
  generate a checked artifact from migration-owned catalog data.
- Tester: the three historical landing-seam bugs (BUG-HAT-001 class) get one E2E spec per
  scope-kind asserting a freshly-granted role lands somewhere — the regression class that
  motivated F1.

### AE4.9 — Option A: make permissions real [IA-F1/F2/F5; adopted 2026-09-02]

**Decision (PO, 2026-09-02, on the implementation audit — ADR
[0176](../decisions/0176-authz-permission-layer-made-real.md)):** retain the permission model and
make it load-bearing. Rejected: Option B (amend D7 down to a role catalog + state gate, drop or park
the permission substrate) — cheap, but it abandons the matrix-as-oracle that D7 exists for, and
the re-key would then happen post-pilot against live users. ⛔ The worst state is the current
one — both models shipped, one inert, the record calling it a catalog cutover.

**Three interfaces, only the third called from product paths:**

1. **Assignment projection** — `authz.assignment_facts` + `authz.holds_role`: which providers
   (memberships, `profiles.is_admin`, later the `administrativo` capability tables) give which
   role at which exact scope. `holds_role` is the **transitional** role predicate: legitimate
   for a site that genuinely asks a role question, and the fallback every not-yet-re-keyed site
   keeps calling.
2. **Positive entitlement** — the runtime evaluator (`authz.has_permission`, state-gated, the
   AE4.4 corrections applied): which permission codes those assignments confer, implication
   closure included. It is **not** final authorization.
3. **Domain authorization** — `app.can_*` authorizers carrying a **statically greppable
   permission code** (D7's own words), composing hard denies (recusal / respondent), lifecycle,
   sensitivity ceilings and tenant/resource rules **before** the positive entitlement. RLS
   policies and command doors call these. Any final-authorization explanation is theirs and
   names the restriction that won; `explain_permission` describes layer 2 only.

**The mechanism: re-key enforcement sites, permission by permission, tracked by a generated
enforcement manifest with NO default arm.** Each of the 43 permission rows declares its domain
authorizer, every direct enforcement site (or a generated call-graph boundary with a reviewed
reason), applicable axes (lifecycle / sensitivity as **data**, never a global omission), the
hard-deny classes outside entitlement, the expected legacy equivalence during its role's cutover,
and owner + expiry for any compatibility exception. Sites still on `holds_role` are listed **as
`pending-rekey` entries**, never absorbed by a default. Generation fails on set difference in
either direction (AE4.5). `holds_role` **product** callers count down to **zero by
AE5-complete** (a role-question site may keep it only with a manifest-recorded reason).

**Sizing (catalog-measured 2026-09-02 — re-derive, never quote):**

| Wrapper | Policies | Function bodies |
| --- | ---: | ---: |
| `is_staff_admin_of` | 63 | 151 |
| `is_staff_admin_of_for` | 2 | 28 |
| the whole `app.is_*_of*` family, all roles (composites included — over-inclusive) | ≈200 | ≈420 |

**Sequencing — why this rides with AE5, not ahead of it:** `staff_admin` holds 42 of 43 codes,
so permission-keyed and role-keyed sites are observationally near-identical until a **second
role with a different bundle shares a site** — the discriminating power arrives with AE5.
Therefore: AE4 proves the **mechanism** end-to-end on the three differential representatives
(`commission.forms.edit`, `org.professionals.create`, `org.professionals.read`) — for each, a
domain authorizer at the site, and the grant-deletion mutation must flip the **production
door**, not the generic resolver; every other permission enters the manifest as
`pending-rekey`; each AE5 role increment re-keys the sites its bundle touches (per-role
checklist, § AE5). ✅ **The Gate AE4 minimum re-key scope is CONFIRMED (PO, 2026-09-02): the
three representatives**, each end-to-end, everything else `pending-rekey` — 0176 D6.
⭐ **AND BUILT 2026-09-02 — this whole paragraph's future tense is DISCHARGED.** Migration `20261003007300` + pgTAP `409` (63/63): all three re-keyed, the grant-deletion mutation flips the **production POLICY door** on each, both polarities, with `409` run against the PRE-migration catalog so every gate-line assertion was observed RED first. ⛔ **"POLICY" added 2026-09-04 (re-review N4) and it is a qualification, not a relaxation** — the DEFINER surface never flipped and was never in D6's scope. For `commission.forms.edit`, **0 DEFINER form functions carry a permission literal** (re-measured 2026-09-04: the sole carrier anywhere in `app`+`public`+`authz` is `app.can_edit_commission_forms`), against the **22** the matrix rules gate form-family tables on `is_staff_admin_of` — so the unqualified phrase over-claimed the moment it was written. Full bound: ADR 0178 Consequences. ADR [0178](../decisions/0178-ae49-d6-rekey-as-built.md). ⛔ Its sequencing CLAIM still stands and is not discharged: the three are observationally near-identical to role-keyed sites until AE5 brings a second bundle, so this proves the **mechanism**, not the discrimination.

**Authority repair — DONE 2026-09-02: ADR
[0176](../decisions/0176-authz-permission-layer-made-real.md) `Amends:` 0155 D7 and 0174** —
the three layers, AE4.6 delivered layer 1 only, the manifest countdown, the AE5-complete
zero-caller bound; 0174's chokepoint now reads as layer 1 rather than as the cutover. ⛔ "Catalog
cutover" still may not appear in any gate record for what AE4.6 built (0176 Consequences).

**Do now — each was fork-neutral, and each is cheap only while callers = 0:**

1. **[IA-F3]** the AE4.4 resolver corrections — scope-kind validation, candidate/runtime split
   with the `authoritative` gate, the two renames, the `denial_reason` domain,
   `permission_not_granted`, deterministic explanation.
2. **[IA-F4]** `assume_role` reads and enforces `session_selectable` (AE4.8), true→false
   mutation proven. `platform_role` retirement stays in the AE5 bundle.
3. **[IA-F2]** populate `catalogPermissions` / `nonLegacyRoles` from the catalog at generation
   time; prove both arms can red. The no-default manifest itself is AE4.9's first artifact.
4. **[IA-F7]** move `role-catalog.test.ts`'s Docker shell-out to a post-reset DB gate.
5. **[IA-F10]** the gate items owed whatever the fork: `BUG-AE47C-LINKAGE-001`'s mechanism, the
   two tester sign-offs, `docs/backend-state.md`'s `authz` section, the rollback runbook +
   out-of-chain template (AE4.6). **[IA-F9]** performance evidence comes **after** the seam is
   fixed, on the final path.

**Explicitly NOT decided here — bundled into the AE5 plan (§ AE5 reminder):** F6
exact-assignment active context, F8 `administrativo` out of `authz.roles`, `platform_role`
retirement, F7's single manifest entry. ⚠ The classification columns (`risk_class`,
`sensitivity_ceiling`, `resource_kind`) have **no reader** [IA-F5]; ADR 0172 defers them
explicitly and that deferral stands — layer 3 is where a consumer appears, or the column is
removed with a named reason.

**Gate AE4 [language per PA-F7/F8/F12, ADR 0162]:** before cutover, every required
decision-table cell has a stable ID, an approved expected result, and an executed test
result, and every legacy/catalog difference is fixed in a preceding gated increment or is a
named compatibility exception with owner and expiry; single-evaluator assertion after; every
assignment referentially valid against the catalog [PA-F1]; all re-pointed arms green **with
the domain qualifier stated** (rule 2) and the C2 subset closed (pilot cutline);
performance acceptance via nested plans over the scaled ANALYZEd fixture [PA-F6]; full §6 +
e2e:prod; QA review; **PO approval = the pilot-gate authz milestone**; Record step
(backend-state.md gains the catalog section; the matrix and census artifacts land under
`docs/design/` or `docs/reviews/` and are linked).
**Added 2026-09-02 [IA]:** the amending ADR (§ AE4.9) accepted; the runtime evaluator rejects
non-`authoritative` roles while the candidate oracle stays testable and non-callable from
product paths; scope kind validated; missing grant / unreachable scope / wrong active context /
inactive principal explain distinctly and deterministically; `assume_role` enforces
`session_selectable`; the enforcement manifest exists with no default arm and generation fails
on set difference; the grant-deletion mutation flips the **production POLICY door** for each of the
three representatives (`commission.forms.edit`, `org.professionals.create`,
`org.professionals.read` — the PO-confirmed minimum, 0176 D6), every other permission
`pending-rekey` in the manifest;
⛔ **"POLICY" added 2026-09-04 (re-review N4).** This acceptance line said *"the production door"*
unqualified, which is the sentence the PO signs, while the oracle and pgTAP `409` § 2.10c had
already scoped the claim to the policy door. The bound: for `commission.forms.edit` **0 of the
DEFINER form functions carry a permission literal** — re-measured on the live catalog 2026-09-04,
exactly ONE object in `app`+`public`+`authz` carries a `'commission.forms.edit'` literal and it is
`app.can_edit_commission_forms` itself — while matrix row 1 rules **22 gate form-family tables on
`is_staff_admin_of`** with none re-keyed (that 22 is cited from the matrix, not re-derived).
`form_item_validations`' real writer
(`public.set_item_validations`, `SECURITY DEFINER`, EXECUTE to `authenticated`) is still layer 1
while `authenticated` holds only SELECT on the table — so grant-deletion closes **5 of the 6**
re-keyed policy doors and at the sixth it closes a door nothing opens
(`FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1`). ⚠ **A qualification, not a relaxation**: ADR 0176 D6
scoped the gate to three representatives at layer 3, and matrix row 1 rules the DEFINER sites `D`
— nothing here lowers the bar, it stops the sentence claiming a surface the bar never covered. performance acceptance measured on the **final** path. ⛔ `e2e:prod` is RED at
`a0b27f3c` (1183 p · 1 f · 62 infra-unproven · 3 flaky · 13 did-not-run); the recorded C2 Tier-1
state is 8 of 171 new enforcers measured, 3 BLIND. None of these is "gate paperwork".

**Traps:** `create or replace` on the wrappers is not DROP+CREATE — but if any signature *must*
change, sweep `has_function_privilege('…(old arity)')` strings first (a stale signature string
**aborts** a pgTAP suite as a plan mismatch in an unrelated file). The differential suite's
fixtures must not share ids across cases (fixture-shared ids fabricate both defects and
all-clears). `00_setup.sql` committing over a migration's claims is a known hazard — check what
the setup file force-sets before trusting a context-dependent green.

---

## Phase AE5 — Role-by-role substitution (post-pilot)

**Purpose:** the remaining roles move to the catalog, one at a time, each through the AE4
template. **Post-pilot by G1** — an unmigrated role runs the current, tested evaluator.

⭐ **DECIDE TOGETHER IN THE AE5 PLAN — one compatibility migration, not four [IA-F6/F7/F8]:**
F6 **exact-assignment active context** (`app.active_role_selections` stores only
`(session_id, user_id, role, chosen_at)`, so selecting a role activates every assignment of it,
while `assume_role` stamps ONE most-recently-granted membership into the audit event — role-wide
hat vs exact assignment `(role_code, scope_kind, scope_id)`; audit scope must match whichever is
chosen); F8 **`administrativo` out of `authz.roles`** (seeded as a 12th row under the
unreachable `capability_plane` sentinel while its own comment says NOT A ROLE — split assignable
roles / assignment providers / entitlement bundles rather than adding sentinels); **retiring
`platform_role`** (`assume_role` takes the enum; its input becomes a validated catalog code —
already AE5-complete territory below); F7 **one manifest entry per role in `role-catalog.ts`**
(today `ROLE_LABELS` + `ROLE_SCOPE_KIND` + `ROLE_ORDER` + `ROLE_BRANCH` + the `scopeSummary`
switch, with `ROLE_MANIFEST` zipping the first three — one ordered entry with code, label, scope,
selectability, landing branch, summary strategy and precedence, the rest derived). **All four
are pre-users design choices; none blocks the AE4 merge; bundling them means the active-context
storage, the enum and the role table break compatibly ONCE.** ⛔ Do not pick one off ad hoc
inside a role increment.

**Proposed order** (each its own increment with the full per-role gate; the PO may reorder):

1. `staff` (simplest matrix; biggest population — flushes out fixture gaps early);
2. `org_admin`, then `hospital_admin` (the AFF2 INTERSECTION/SUBSET semantics ride along —
   their matrices cite `personScopeAllows` cases explicitly);
3. `nsp_org_admin` + `nsp_coordinator` (paired — the NSP roster invariants live between them);
4. `technical_director` + `technical_director_deputy` (the one-titular-per-hospital rule stays
   a **domain office constraint** — the partial unique index does not move into the catalog;
   the catalog only carries the permission bundle);
5. `quality_reviewer`, `pqs_member`;
6. `administrativo` capability plane — **mapped, not merged**: `commission_administrativo_capabilities`
   rows adapt to permission codes; the appointment tables stay (audit §6.3) — ⚠ shaped by the
   F8 decision in the bundle above;
7. `platform_admin` **last**: `profiles.is_admin` remains the assignment fact via the adapter;
   the **noun rule** (ADR 0078 A35 — tenancy/identity/vocabulary/audit yes, content/PHI never)
   is encoded as *hard restrictions* in the resolver, mutation-proven, before the role flips
   `authoritative`.

**Per-role checklist (the AE4 template, abbreviated):** matrix derived from all planes (both
helper-name forms swept) → PO approves → seed → generated-cell differential under the
[PA-F8] diff rule → atomic wrapper cutover (to `holds_role`, layer 1) → **re-key the
enforcement sites this role's bundle touches to their domain authorizers — manifest entries
`pending-rekey` → done, the grant-deletion mutation flipping each production **policy** door
(§ AE4.9; ⛔ qualified 2026-09-04 per re-review N4 — a re-key at the policy leaves the DEFINER
surface on its legacy gate, and this template is what AE5 will copy)** →
direct-call census → arms re-pointed (G8) → legacy branch removed + rollback runbook/template
updated ([PA-F9] — never a committed migration) → Record.

**AE5-complete (the ADR's re-analysis trigger 4):** retire the legacy adapter, the
`platform_role` enum's remaining consumers (token hook included — its claim value becomes a
catalog code; prove revocation/suspension/rotation behavior unchanged; `assume_role`'s input
becomes a validated catalog code at the same moment [PA-F1]), the legacy
`memberships_role_check` + scope-shape CHECKs (superseded by AE4's composite-FK binding —
this retirement is what ends the catalog's **authority-elect** status, ADR 0162 §2), and the
role-name grep gates that the catalog arms have superseded — each retirement its own
reviewed change, with whatever remains filed as named debt.

---

## Phase AE6 — Session-context granularity: DECIDED, record-only

G4: role-type semantics are final-for-now; the selection vocabulary references the catalog
(landed in AE4.8/AE5); exact-scope contexts require their own ADR with token-hook, revocation
and session-rotation design. **No build tasks.** The only standing rule: no effective permission
list ever goes into the JWT. ⚠ **2026-09-02:** the vocabulary reference has **not** landed
(`session_selectable` has zero readers — AE4.8 "do now"), and F6 exact-assignment context sits
in the AE5 bundle; if adopted there, that ADR supersedes this section's record-only status.

---

## Phase AE7 — Generic scopes: DEFERRED (= ADR D6)

Not scheduled. Entry conditions (all before a proposal is even writable):

1. a forcing function from D6's broadened list;
2. `EXPLAIN (ANALYZE, BUFFERS)` on real data (AE0.2's baselines are the comparison floor);
3. the closure-table or hoisted-`my_reachable_scopes()` shape — per-row ancestry is not
   proposable;
4. the caller enumeration D5 would have produced (the demoted step's residue);
5. the `**Amends:** 0041` label.

---

## PO decision points, collected

| When | Decision | Prepared by |
| --- | --- | --- |
| AE0.5 | matrix axes approval | lead |
| AE1.2/4 | the `anon`-residue sweep ruling (`FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED`) | backend |
| AE1.4 | ✅ **RULED 2026-08-27** — the 11 `.rpc()` sites (1 in-function door, 10 system-actor; riders R1–R3; 4 observations → 1 fix + 3 FUPs) → [rulings](../design/authz-ae1-rpc-rulings.md) [PA-F10] | backend |
| **AE2.0** | ✅ **RULED 2026-08-27** — offboarded-person lifecycle authority: **(a) last-org retention**, SUBSET capabilities, four bounds → [ADR 0163](../decisions/0163-offboarded-person-lifecycle-authority.md) | lead |
| **AE2.4** | **containment-trigger disposition (T2 or a third option): accept the anchorless-profile window that opens once the column goes, or design around it. ⛔ T1 rejected; the window is inherent, not T2-introduced** | backend + PO |
| AE3 branch-cut | confirm pilot has not loaded data (else dual-write re-plan) | lead |
| AE4.3 | the `staff_admin` matrix (becomes the oracle) | lead + backend |
| **AE4.9** | ✅ **RULED 2026-09-02** — on the [implementation audit](../reviews/authz-evolution-implementation-audit-2026-09-02.md): **Option A — make permissions real** (three layers, manifest countdown, re-key sequenced with AE5) — recorded in ADR [0176](../decisions/0176-authz-permission-layer-made-real.md) (`Amends:` 0155 D7 + 0174) | lead + PO |
| **Gate AE4** | ✅ **RULED 2026-09-02** — the **minimum re-key scope** is the three differential representatives end-to-end (`commission.forms.edit`, `org.professionals.create`, `org.professionals.read`), everything else `pending-rekey` in the manifest — 0176 D6 | PO |
| **AE5 plan** | the bundled four: F6 exact-assignment context · F8 `administrativo` out of roles · `platform_role` retirement · F7 single manifest entry — decided together, one compatibility migration | lead + PO |
| AE5, per role | each role's matrix; the substitution order | lead |
| AE5.7 | `platform_admin` noun-rule restriction review before flip | qa + PO |
| §8 residue | inheritance-per-permission, high-risk ceilings (expiry/reason/second-approval), revocation SLA — resolved with the first role whose matrix needs each | lead |

## Risks, named

- **C1a aging (G10):** every AE Record step re-checks that C1a/C1b still head the ▶ queue and
  says so in the pinned ⭐⭐ Critical list (`docs/followups/follow-ups-open.md`, C1's row). This
  plan's existence must not be the reason the disposal rehearsal slips.
- **Pilot boundary drift:** G2's single-shot authorizations (AE3, and AE2.4's demote-then-drop)
  are premised on no real data; the premise is re-measured (never quoted) at each branch-cut.
- **Two evaluators by accident:** the only sanctioned mixed states are per-role
  (`authoritative` vs `legacy`) and — during § AE4.9's re-key — **per-site between the
  catalog's own two layers** (`holds_role` at a `pending-rekey` site, a domain authorizer at a
  re-keyed one), never per-caller, never per-path, never `legacy_allowed OR new_allowed`; the
  manifest countdown is the tripwire for the second, the AE4.6/AE4.7 assertions for the first,
  and QA reviews specifically for OR-shapes. ⛔ A third state — a designated authority with
  **zero callers** beside a sibling that has all of them — is what the 2026-09-02 audit found;
  a census returning `<none>` for callers of the thing an ADR names as the runtime path is a
  conformance finding, whatever question was being asked.
- **Gate-baseline churn:** each phase re-baselines the ARM findings at its Record step so the
  next phase's diff answers "mine or pre-existing?" — the exact failure D0 reason 5 named.
- **Parallel branches:** rule 6. AE phases are strictly serial after AE1 (AE0∥AE1 allowed;
  AE4.8's frontend track runs inside AE4's branch under file ownership, not beside it).
- **Windows/encoding:** tracker and plan edits via the Edit tool only; no `sed -i`, no
  redirection through a cp1252 console (`lint:mojibake` is the backstop, not the control).

## Sizing (inferred, not measured — do not quote as commitments)

AE0 ~2–3 sessions · AE1 ~4–6 **as originally drawn from the 12-site census — resized upward
2026-08-27 against 45 sites + the tiered DEFINER review [PA-F10/F11]; treat the old upper
bound as a floor** · AE2 ~3–5 (+ the AE2.0 ruling latency) · AE3 ~3–4 · AE4 ~6–10 (matrix +
oracle + arms dominate; AE4.8 ∥ inside it; the generated cell artifact [PA-F7] front-loads
AE4.5) · AE5 ~2–4 per role · the C2 subset closure (pilot cutline, ADR 0162 §3) is its own
unsized increment. Pre-pilot total: roughly 18–28 working sessions, now itself a floor.
**2026-09-02:** § AE4.9 adds the amending ADR, the manifest and three representative re-keys to
AE4, and a per-role site re-key to every AE5 increment — unsized; the AE5 figure is now a floor.

## Cross-phase debts named by the 2026-09-02 implementation audit

Each is **already in the register** (`docs/progress/follow-ups.md`, indexed in PROGRESS.md) with
an owner; the audit asks for **pre-pilot priority**, not discovery. ⛔ None is a reason to leave
the permission model disconnected — they are pre-live liabilities to retire while the same team
is already inside authorization.

| Follow-up | Why the audit names it now |
| --- | --- |
| `FUP-AE1-REVOKE-SET-EXECUTION` | AE1 classified 233 revokes and executed none; 137 are silent no-ops as written because privilege stays reachable through `PUBLIC`. The sealed `authz` schema does not compensate for old reachable doors. |
| `FUP-AUTHZ-HARNESS-TRANSACTIONAL` | The mutation harness neutralizes live gates outside a transaction; process death can leave an unconditional allow installed. Every AE5 mutation multiplies that operational risk. (Partially resolved 2026-08-17; the filed remedy withdrawn as unbuildable.) |
| `FUP-AE2-VOID-LAST-ORG-AFFILIATION-UNMAPPED` | ADR 0164's containment trigger (`23514`) still reaches the user as a generic retryable error, and the guard that looks like it covers this is bounded to doors, not the trigger path. |
| `FUP-DBPUSH-SWALLOWS-NOTICE` | AE3's prescribed push command hides the only non-vacuous moved-row count, so a 0/0 parity can pass. A warning against console-only cutover evidence in AE4's own cutover and rollback. |
