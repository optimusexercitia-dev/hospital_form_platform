# Backend State — authorization, privilege and audit

> Part of `docs/backend-state/` — **start at [`README.md`](README.md)**, which routes you to the
> one file you need and carries the maintenance rules in full. ⛔ A posted section is FROZEN:
> correct it by APPENDING a `⚠ **Superseded** — … See <file> § <heading>.` marker, never in place.

⚠ **The corrected pt-BR authority messages (`dispose_case_phi`, `revoke_printed_document`) are recorded in [`document-model.md`](document-model.md) § END STATE.** ⛔ That frozen text says **three** and names **two**; the third is not identified anywhere, and the discrepancy is inherited, not introduced here (QA m14). Re-derive from the catalog before relying on the count. The class matters here: every arm that moved had left its message behind, and no gate reads prose.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below; the rules that govern it are [`README.md` § Maintenance rules](README.md#maintenance-rules) 7–8.

### Surface

- **`public.audit_log`** — the Rule 11 trail. `authenticated` = `r` only; every write goes through the DEFINER
  writer `app.audit_write`. Its read policy `audit_log_select` is legged by scope (staff_admin of the commission ·
  tenancy admin of it · hospital-tier · org-tier · a platform leg needing all three scope keys NULL).
- **The `authz` catalog** — `roles` · `permissions` · `role_permissions`, behind three declared interfaces: layer 3
  domain authorizers (the permission code is a statically greppable **string literal**) · layer 2 resolvers · layer 1
  assignment projection. **No client role reaches `authz`** — anon, authenticated *and* service_role — and the schema
  is absent from `config.toml`'s exposed schemas. Authority helpers pair caller-keyed with **subject-keyed (`_for`)** twins; a predicate parameterised on a principal uses the `_for` twin (ADR 0200).
- **The zero-policy, door-only table class** — RLS on, **0 policies**, `authenticated` *and* `anon` hold nothing,
  `service_role` holds all four verbs; membership is DERIVED, not hand-listed (`supabase/tests/382_…`, § A0).
- **The quality-office plane** — `quality_reviewer`, `commissions.quality_oversight` (`visible|excluded`), its ONLY
  writer `public.set_commission_oversight`, the raw-write trap `app.guard_commission_oversight`.
- **The service-role DML registry** — one row per `createAdminClient()` write site in `src/`, keyed
  `path::symbol::writeKind::target`. Door and helper signatures, `prosecdef` and EXECUTE grants:
  [`generated-rpc-surface.md`](generated-rpc-surface.md) · [`generated-helper-surface.md`](generated-helper-surface.md).

### Invariants

- **A DEFINER door bypasses RLS entirely**, so cutting a table's policies does not cut its doors — the recorded failure
  here: tables cut, DEFINER doors left open, every gate green, each blind differently (a table-visibility matrix cannot
  see a door by construction; the door sweep neutralizes *boolean* gates and these return `SETOF`; `ARM=floor` asks
  whether a door is **called**, not whether its gate is **right**; pgTAP asserted tables, not doors). What found it:
  re-reading the ratified CUT list and asking the catalog item by item — a check **no harness performs**.
- **On the door-only class the GRANT layer is what denies today, not RLS.** Postgres checks table privilege before RLS
  is ever evaluated, so the observed 42501 is the absent grant; the 0-policy state is a **backstop**, operative only
  the day a verb is granted without a matching policy.
- **The privilege-budget ceiling moves only by PO ruling**, and no increment may raise the count without a **named
  justification in its own gate record**. The ceiling has ONE home — the `BUDGET-ANCHOR` comment, machine-read by gate
  15 against the literals in `supabase/tests/320_…` § U4; ⛔ editing it to match a changed pin inverts the authority the
  gate enforces. **No revoke has been executed**: the proposed set is a scheduling fact, `UNCHANGED` in its partition is
  **unexamined, not cleared**, and a revoke is not free either — it removes a function from `ARM=floor`'s domain.
- **Every service-role write site is registered and machine-diffed** — gate 11 multiset-diffs the census against the
  `Key` cell of every row; a missing `Key` header, an unparseable key, and a parse yielding **zero** keys are each
  their own red, because an empty parse must never read as a clean diff. The census **under-counts by design**
  (`callDoor` sites are invisible to it) and the gate asserts that substitution in *both* directions. ⚠ **"None found
  in TS" is not "unaudited"** (a DB-side trigger is a `pg_trigger` question this registry does not ask), and `door: X`
  is a door's NAME only — that its body re-derives authority rather than trusting `p_actor` is a `prosrc` question.
- **`audit_log` is append-only and cannot be backfilled — barred twice:** `guard_audit_immutable()` rejects any UPDATE,
  and `organization_id` feeds `app.audit_canonical` → the `row_hash`, so a forced row stops replaying its own hash.
  `app.audit_write` **DERIVES** the organization from the hospital but does **not validate** it — an explicitly-passed
  org still wins, even a foreign one, and no CHECK ties `audit_log.organization_id` to the hospital's org.
- **The noun rule and the content wall.** A row that hands a `platform_admin` tenant *content* is a noun-rule breach;
  the tenancy admin *shapes the containers, never reads what goes in them*. ⚠ `app.is_tenancy_admin_of(_for)` is
  **NOT** the commission's own admin — it is **FALSE for `staff_admin`**, whose coordinator is admitted by the separate
  `app.is_staff_admin_of` disjunct beside it. ⛔ `\yis_tenancy_admin_of\y` cannot match `is_tenancy_admin_of_for`, so a
  sweep grepping the short name is silently blind to every `_for` call site.
- **The catalog is authority-ELECT, not authority** — `authz.roles` is an *additional* role authority beside
  `memberships_role_check`, the scope-shape CHECK, `public.platform_role` and the TypeScript manifest, **not a
  replacement**. A policy or door calling layer 1 or 2 **directly for a permission decision** is a finding, and the
  enforcement manifest is how it is found. A re-keyed authorizer is **not** purely permission-keyed: residual
  non-permission arms sit inside the DEFINER body, invisible to anyone auditing `pg_policies`, so they are pinned **BY
  NAME** — adding an arm reds the pin, *retiring* one reds it too.
- **A predicate's arms must answer about the principal its own signature names.** `can_manage_professional` and `can_read_professional_profile` are subject-keyed on `p_uid` since ADR 0200 — both were wholly caller-keyed before, and AE4.7c's narrowing removed the last arm that read the parameter; `is_admin()` and `is_admin_for()` are **not** interchangeable at SELF (a JWT-claim fast path vs a `profiles` read).

### Rollout

- Cutovers here are **flagless by pattern**: for the private-details split, the `authz` catalog and the audit read
  legs, the **migrations ARE the cutover**; the content wall is **subtractive by design**; quality-office oversight is
  deny-by-default via the `'excluded'` column default plus the role grant, not a flag. ⛔ Resolve any flag's VALUE and
  readers from [`generated-feature-flags.md`](generated-feature-flags.md), never from a sentence here. Rollback:
  [`authz-rollback-runbook.md`](../deployment/authz-rollback-runbook.md) — ⛔ restore the **disjunct**, not the whole
  policy body, and **both halves** of a `FOR ALL` policy.
- ⛔ **Deployment status is not stated in this layer** (ADR 0198 D5). Whether a migration reached the remote is a claim
  about an external system that rots silently — measure it with the recipes in
  [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).

### Open edges

- **"Measured" is not "clean", and a row is not a pass.** In the write-path sweep a **BLIND** row is a real finding to
  keystone, ⛔ **never allowlisted**; an **ERROR** row is UNVERDICTED, not COVERED. `FROMFINDINGS=1 ARM=policy` is a
  separate, pre-existing RED, not one of CLAUDE.md § 6's arms.
- `hardDenyClasses` is **empty on every manifest row** — honest bookkeeping, **not coverage**; the zero is a **search
  horizon, never an absence**. **`410` proves nothing about enforcement**; the behavioural proof is `409`, on **writes**.
  **No performance evidence exists** for the final path — measure policy → layer 3 → layer 2 → layer 1, never `holds_role`.
- Registry rows reading `NONE` / `UNCONFIRMED` are a measured property of the platform, not a review gap:
  `registerUser`'s shared entry gate has no found assertion that a non-admin caller is REJECTED, and that is **not
  proven absent**. Referral doors still carry the tenancy arm at the DB while the UI 404s a bare tenancy admin
  (BUG-QOB-004, PO ruling pending — ⛔ do not "fix" either side without it). Platform-owned TRUNCATE grants (`storage.*`,
  `net.*`) to `anon` **and** `authenticated` are **unchanged and not revocable by us** — on Cloud the REVOKE returns
  **no error** and changes nothing.
- Two frozen paragraphs below state **different** privilege-ceiling values; the later PO ruling governs and gate 15's
  `PROSE_RE` does not match the older form, so only a hand-written note stands between them. The pt-BR authority messages
  in [`document-model.md`](document-model.md) say **three** and name **two** — inherited, not introduced; re-derive both.
- Neither `is_admin()` nor `is_admin_for()` consults `app.is_active`, so a deactivated `platform_admin` passes every admin arm — before and after ADR 0200 (`FUP-IS-ADMIN-ARM-IGNORES-PRINCIPAL-STATE`); nothing reds if a NEW predicate pairs a caller-keyed arm with a `p_uid`-keyed one.

### Where the detail lives

- The frozen slices below, in order: **§ Zero-policy tables** · **§ Privilege budget** · **§ Service-role DML
  registry** · **§ AE3** · **§ AE4** · **§ Audit read legs** · **§ Client-role TRUNCATE grants** · **§ QO·B** ·
  **§ QO·FUP** · **§ QO·A** · **§ RLS authorization surface**.
- ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) · [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) (authority-elect) ·
  [0176](../decisions/0176-authz-permission-layer-made-real.md) (the three interfaces) · [0100](../decisions/0100-quality-office-oversight.md) (oversight + content wall) ·
  [0149](../decisions/0149-org-admin-reads-hospital-tier-audit.md) + [0150](../decisions/0150-audit-org-derived-from-hospital.md) (audit read legs) ·
  [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the standing door audit).

## Zero-policy tables — door-only by design (AE1.6; ADR 0155 D9; measured 2026-08-27)

_The security advisor's RLS-enabled / zero-policy findings, recorded here so they read as
the deliberate pattern ARCHITECTURE.md Rule 1 already names ("audited single door with
ZERO policies" / the PHI posture) rather than as missing coverage. Pinned by
`supabase/tests/382_zero_policy_tables_are_door_only.sql` (`plan(72)`, PASS — close #6 added §5; QA m1 added §A0's set-closure assertion). Like
"Testing the schema" and "Remote discipline" above, this never concludes — it is a
standing registry, re-checked by the pgTAP file, not a phase narrative._

**MEASURED, not the plan's assumed shape** — on all seven tables below,
`has_table_privilege('authenticated', …)` is **false** for all four DML verbs (checked
positively; `relacl` is NOT null on any of the seven, so this is not the "NULL proacl
includes PUBLIC" trap — there was simply no grant to `authenticated` or `anon` to find,
table- or column-level). So **two independent layers deny access** on these seven: the
GRANT layer (no ACL entry for `authenticated` at all) and the RLS layer (RLS enabled, 0
policies). Recording both matters because either could widen independently — but only the
GRANT layer is what a live query actually hits: Postgres checks table privilege before RLS
is ever evaluated, so the observed runtime error on every one of these seven (42501,
"permission denied for table") is the GRANT layer, not RLS. RLS's 0-policy state is a
backstop, not currently the operative denial mechanism — it becomes operative only the day
a future grant is added without a matching policy, which is exactly the accidental
widening this pin exists to catch.

| table | why no policy | door(s) — the only access path | pgTAP |
| --- | --- | --- | --- |
| `case_print_revisions` | monotonic print-currency counter (PDF·P3, ADR 0144 D4/D15); kept off `cases` because `app.guard_case_status` freezes that table in states this counter must still move in | write: `app.bump_case_print_revision` · read: `app.print_source_revision` / `app.print_source_head` — all three `app`-schema DEFINER, **no `authenticated` EXECUTE at all** (internal-helper class, measured; called only from other DEFINER bodies) | `382` §A1–A2, §B1–B4, §C13 |
| `meeting_closed_session_items` | restricted-visibility closed-session meeting content (ADR 0078 Gate-2 reserved-child-lock pattern) | write: `public.add_reserved_item` · read: `public.get_reserved_session_items` · disposal: `public.dispose_meeting_minutes` · guard: `app.guard_reserved_child_lock` (trigger) — the three `public` doors are `authenticated`-EXECUTE, all DEFINER | `382` §A3–A4, §B5–B8, §C14 |
| `meeting_closed_session_item_readers` | the closed-session item's reader roster (who may see it) — same posture as its parent | same doors as `meeting_closed_session_items` (`add_reserved_item` / `get_reserved_session_items`), except `dispose_meeting_minutes` (items only, not readers) | `382` §A5–A6, §B9–B12, §C15 |
| `patient_identifiers` | **Rule 12 Class-1 patient PHI** — isolated case-module identifier set (ADR 0038, re-keyed by F1/ADR 0064+0066, gated by ADR 0078) | write: `public.set_participant_patient` (coordinator-gated wrapper over `app._set_participant_patient_unchecked`, `prosecdef=f` deliberately — ADR 0134 Amdt 2's two-gate shape) + the three creation RPCs (ARCHITECTURE.md Rule 12) · read: `public.get_case_patient` / `public.get_case_patients` / `public.get_participant_patient` | `382` §A7–A8, §B13–B16, §C1–C4 |
| `patient_participants` | **Rule 12 Class-1 patient PHI** — the type-gated patient-participant chain `patient_identifiers` keys off (Appendix A dialect 3) | **no standalone reader** — reached only as a JOIN through the `patient_identifiers` doors above; gated by the read predicate `app.can_read_case_patient` and the trigger `app.guard_case_patient_required` | `382` §A9–A10, §B17–B20, §C5–C8 |
| `referral_patient` | **Rule 12 Class-1 patient PHI** — inter-committee referral module (ADR 0037), modeled on `event_patient` | write: `public.save_referral_patient` (`public.set_referral_patient` **left the public API**, ADR 0078 D7/F1 — measured: `authenticated` has NO EXECUTE on it) · read: `public.get_referral_patient` | `382` §A11–A12, §B21–B24, §C9–C12 |
| `verification_lookups` | minimal verification-scan log (ADR 0104 D12) — kind + credential-hash + timestamp + matched only, never the raw token, never an actor, never `audit_log` | `public.lookup_printed_document` — the ONLY consumer, and **not even `authenticated`-EXECUTE**: measured `service_role`-only (M2) | `382` §A13–A14, §B25–B28, §C16 |

**Mechanism, stated once so a future reader doesn't conflate the two claims:**
- **GRANT layer** (`382` §B statically, §C at runtime) — `has_table_privilege` catalog
  checks + a live 42501 for every verb attempted as `authenticated`. This is what an actual
  PostgREST or SQL call hits FIRST, and it is the layer actually enforcing the denial today.
- **RLS layer** (`382` §A) — `relrowsecurity = true` + zero `pg_policies` rows. Structural
  only; not independently observable at runtime today because the grant layer already
  blocks before RLS is evaluated. Recorded anyway — it is the layer that matters the day
  someone grants a verb here without adding a policy to go with it.
- **Positive control** (`382` §D) — the same `has_table_privilege` / `pg_policies` /
  live-query shapes shown PASSING (reporting "granted"/"has a policy") on `public.commissions`
  (a genuinely granted, policied table) and walked through grant→revoke / policy-add→drop
  live on one ephemeral table, both directions moving the detector. Without this, a green
  "everything is denied" file would be unfalsifiable — this makes a red here trustworthy as
  a real regression.

## Privilege budget — `authenticated`-executable DEFINER count (AE1.2; ADR 0155 D9; PA-F11)

**A recorded number with neither a ceiling nor a merge rule is inventory, not a budget** — so
both are stated here, not left to the gate record to imply.

| line | value | derived |
| --- | ---: | --- |
| DEFINER functions in `app` + `public` | **856** | re-derived 2026-08-27 at head `20261003005300`: `public` **460** + `app` **396**. ⛔ **Was 843** (ADR 0160 D3) — moved by exactly the **13** AE1.3 objects (6 doors + 6 kernels + the predicate). Re-measure; ADR 0160's *"quote 843, never 842"* settled a dispute between two instruments at one instant and is not a licence to quote it later |
| …of which **`authenticated` may EXECUTE** — **the budget** | **752** | `public` **432** + `app` **320**. ⭐ **Unmoved by AE1.3, and that is a result, not a coincidence**: the row below predicted the 13 new objects would stay out of this population because they grant `service_role` only. Confirmed at head `…005300` |
| **Tier 1** — remotely reachable (exposed schema + effective EXECUTE) | **523** | ⛔ **Was recorded as 432, which is the DEFINER SUBSET, not Tier 1.** Corrected 2026-08-27 (tier-1 threat review F-T1-1): `public` DEFINER **432** + `public` INVOKER **90** + `graphql_public.graphql` **1**. The 90 are exactly the class ADR 0079 Amendment 7 exists for — a `public` INVOKER wrapper in front of an `app` DEFINER body, in no arm's domain at all. ⚠ **This row was the falsified figure standing in the file every session is told to read instead of measuring** |
| **Tier 2** — `app` schema (`anon` holds no USAGE) | **320** | boundary = `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` — ⚠ **CLOSED 2026-09-08**, folded into `follow-ups-archive.md`; the boundary is now **gated** as `lint:config-schemas`, which pins `supabase/config.toml`'s `[api].schemas` key. ⛔ That gate proves the **FILE** never gains `app`; it does **not** prove the **deployed** PostgREST config matches the file. `app` is not PostgREST-exposed |
| proposed revoke set | **233** | ⛔ **NONE EXECUTED — a scheduling fact, not an RV0 verdict.** RV0's partition (`docs/design/authz-ae1-revoke-partition.md` §5.1) **held 23**: 44 PROCEED property-rescued · 5 PROCEED name-rescued · **23 HOLD** · 161 UNCHANGED. The only rulings holding anything are RV1 (batch 4, **4**) + RV2 (`set_participant_patient`, **1**). ⚠ **Was *"all HELD under RV0"***, which reads as RV0 blocking the whole set when it cleared 49. ⛔ And UNCHANGED is **unexamined, not cleared** |

**CEILING: 759.** ⛔ **Superseded value, quoted so the move is visible and not silent: `CEILING:
752`** (the figure this file carried from 2026-08-27 to 2026-09-08). **Moved by PO ruling dated
2026-09-08** — the ruling, its measured basis and the legitimacy argument are the subsection
*"the ceiling MOVES to 759 by PO ruling"* at the end of this section. **MERGE RULE (unchanged):** no
increment may raise the count without a **named justification in its own gate record**, and **the
ceiling moves only by PO ruling**.

<!-- BUDGET-ANCHOR ceiling=759 app=326 public=433 total=759 -->

⚠ **This is the ceiling's ONE home** (ruling R10). The HTML comment above is machine-read by
**`npm run lint:budget-anchor` (gate 15)**, which mirrors these four figures against the literals
pinned in `supabase/tests/320_act_expiry_and_acl_hardening.sql` §U4 and reds on any disagreement.
⛔ Do not edit the comment to match a changed pin — that inverts the direction of authority the
gate exists to enforce.

> ⚠⚠ **DISCHARGED 2026-09-08 — READ THIS BEFORE THE BLOCK BELOW.** Everything from here to the end
> of this blockquote is a **dated 2026-09-03 record** and is **correct as of that date and stale as a
> present-tense claim**. Since then: all seven were **attributed** (three-head set diff), four proved
> **structurally required** by live RLS policy expressions, and the **PO moved the ceiling 752 → 759
> by ruling** — see § the 2026-09-08 ruling below, and `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN`,
> now **CLOSED** and folded into `docs/followups/follow-ups-archive.md`.
> ⛔ In particular *"THE OTHER SIX ARE UNATTRIBUTED, AND THAT IS THE FINDING"* and *"The ceiling is
> NOT edited here"* are **both superseded**; they are kept, not deleted, because the block records
> what was true when the breach was found.
>
> ⭐ **Why this note exists at all, and it is the batch's own defect:** the sibling stale sentence
> five lines below (`CEILING: 752` is UNCHANGED above) **did** get a forward-pointing note at the
> Record step, and this blockquote — which is **louder** (⛔⛔), **earlier in the file**, and carries
> the headline a scanning reader takes away — got **none**. One of two adjacent stale present-tense
> blocks was repaired. *Sweeping one sibling axis reads as sweeping the class.* Found by a
> second-pass audit, not by any gate.
>
> ⛔⛔ **RE-MEASURED 2026-09-03 AT HEAD `20261003007330`: THE BUDGET IS 759 — SEVEN OVER THE
> CEILING, AND THE BREACH PREDATES THE INCREMENT THAT FOUND IT.**
>
> | | measured 2026-09-03 | recorded above (2026-08-27, head `…005300`) |
> | --- | ---: | ---: |
> | DEFINER in `app` + `public` | **880** (`app` 415 · `public` 465) | 856 |
> | …`authenticated` may EXECUTE — **the budget** | **759** (`app` 326 · `public` 433) | 752 |
>
> Query, so it is re-run rather than quoted:
> `select n.nspname, count(*) filter (where p.prosecdef) definer, count(*) filter (where p.prosecdef and has_function_privilege('authenticated', p.oid,'EXECUTE')) auth_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','public') group by 1;`
>
> ⭐ **NAMED JUSTIFICATION for the +1 this increment owes** (ADR
> [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md)):
> **`app.current_professional_read_organizations()`** — the narrow door
> `professional_profiles_select` consults so the permission answer is computed once per
> *statement* rather than once per protected row. It must hold `authenticated` EXECUTE because an
> RLS policy predicate is evaluated as the invoking role. It takes **no principal argument** (the
> principal is bound to `auth.uid()` internally) and is fixed to one permission and one resolution
> kind, precisely so it is not the generic capability-map reader a wider signature would be.
> Its two `authz.*` collaborators are **postgres-only** and enter no client-reachable population.
>
> ⛔ **THE OTHER SIX ARE UNATTRIBUTED, AND THAT IS THE FINDING.** This increment accounts for one.
> Six more `authenticated`-executable DEFINER functions arrived between 2026-08-27 and 2026-09-03
> and **no gate record names them** — which is exactly what the merge rule exists to prevent and
> exactly what the ⭐ note below predicts: *"it rises silently, one convenient `grant execute … to
> authenticated` at a time, each individually defensible."* ⛔ **The ceiling is NOT edited here** —
> it moves only by PO ruling, and quietly raising it to 759 would convert a breach into a baseline.
> Filed as `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN`.

### 2026-09-08 — the seven are ATTRIBUTED, function by function (Batch 7, `PRIVILEGE-SURFACE`)

⛔ **`CEILING: 752` is UNCHANGED above and is not edited here.** The ceiling moves only by PO
ruling; this section supplies the measurement a ruling needs and nothing more.

> ⚠ **2026-09-08, later the same day — READ THIS BEFORE THE SENTENCE ABOVE.** The ceiling **DID**
> move, to **`CEILING: 759`**, by PO ruling R24, in the subsection *"the ceiling MOVES to 759 by PO
> ruling"* **below** this one — and the anchor at the top of this section already reads `759`. So a
> reader arriving here meets a present-tense sentence that is false about the document in front of
> them. It is left as written, per this repo's convention that a correction is a **dated note beside
> the original, never a rewrite**: the sentence was TRUE when this attribution section was written,
> and it describes **this section's own scope** — the attribution measured the seven and deliberately
> did not touch the ceiling, which is exactly what made the later ruling legitimate rather than a
> breach rebased into a baseline. ⛔ Nothing gates this: gate 15's `PROSE_RE` is `/\*\*CEILING:/` and
> does not match ``**`CEILING: 752`**``, which is why P3 still finds exactly one prose ceiling and why
> this note is the only thing standing between the two sentences.

**Three heads, each a fresh `supabase db reset`, each identified by the PAIR `(max(version),
count(*))` — a head alone does not identify a migration set** (`…004710` was inserted *below*
`…005300` after the commit that added it, which is why the AE1 doc records 484 on disk while that
commit carries 483):

| head | pair | DEFINER `app`+`public` | **budget** | `app` | `public` |
| --- | --- | ---: | ---: | ---: | ---: |
| `…005300` | 484 | 856 | **752** | 320 | 432 |
| `…007330` | 522 | 880 | **759** | 326 | 433 |
| `…007350` **(live head, canonical reset)** | 524 | 880 | **759** | **326** | **433** |

Heads A and B reproduce their historical measurements (2026-08-27 and 2026-09-03) **to the unit**,
which is what licenses pointing the same instrument at new ground. Method: `supabase db reset
--local --version <head>`, which reaches a head **without moving any migration file** — the run's
`git status --porcelain -- supabase/migrations` was 0 before and after. Six per-head checks gated
every snapshot (head pair · two object-level markers proving the *schema* truncated and not merely
the registry · a positive canary · a negative canary with its discrimination half · a two-instrument
count reconciliation); a head failing any check was to be discarded, and none did.

**A→B is 7 ADDED and 0 REMOVED** — measured as a set difference, because a count of +7 is equally
consistent with 9 added and 2 removed. All seven are **new functions**, absent from head A under
*any* signature and *any* privilege state (so none is a re-key wearing a new identity), and all
seven hold an **explicit** `authenticated=X/postgres` grant — none arrives via the default-ACL
PUBLIC route. ⇒ The follow-up's predicted mechanism (*"one convenient `grant execute … to
authenticated` at a time, each individually defensible"*) is **confirmed, not falsified**.

| # | function | created + granted by | justification |
| --- | --- | --- | --- |
| 1 | `app.can_administer_person_via_affiliation(p_person uuid)` | `20261003005400_ae22_person_authority_via_affiliation` (:204-205) | none on record |
| 2 | `app.can_edit_commission_forms(p_commission_id uuid, p_uid uuid)` | `20261003007300_ae49_d6_rekey_three_representatives` | none on record |
| 3 | `app.current_professional_read_organizations()` | `20261003007320_ae4_statement_scoped_authorized_scope_ids`; body re-created by `…007330` | ⭐ **the one already named** (ADR 0182) |
| 4 | `app.is_affiliated_with_hospital(p_hospital_id uuid)` | `20261003007000_bug_meusdados_hospitals_self_affiliation_arm` (:93-94) | none on record |
| 5 | `app.is_affiliated_with_hospital_for(p_hospital_id uuid, p_user_id uuid)` | `20261003007000_…` (:91-92) | none on record |
| 6 | `app.person_has_active_org_affiliation(p_person uuid, p_organization uuid)` | `20261003005800_ae24_inc4_linkable_picker_on_affiliations` (:139-140) | none on record |
| 7 | `public.recover_orphan_person_to_org(p_user uuid, p_organization uuid, p_started_on date)` | `20261003006100_adr0168_three_doors_orphan_recovery` (:764-765) | none on record |

**Zero `UNATTRIBUTED-BY-TEXT`.** ⚠ Attribution is a **text** claim — `pg_proc` carries no
"created by" column — but it is bounded on both sides by catalog measurement: each function is
**absent at A**, **present at B**, and has **exactly one** creating statement in the 38-migration
window between them (only #3 has two, and both are named). ⛔ Five of the seven grants are written
across **two lines**, and a line-anchored `grep` for `grant execute … authenticated` finds none of
them — the same shape as *`grep -A` on a declaration cannot see its docstring*.

**B→C is 0 ADDED and 0 REMOVED.** ⛔ **A zero count delta is not zero change**, and this empty set
is the *measurement* that says so — never the inference from 759 == 759. `…007350` really did
rewrite `public.set_item_validations(uuid, jsonb)`'s body (the run's own marker check proves the
body moved). ⇒ The correct claim is **"Batch 4 moved no member of the privilege population"**;
*"Batch 4 changed nothing"* would be false, and an identity-keyed set diff is structurally blind to
a body rewrite under an unchanged signature.

⚠ **Re-derive, never quote.** The figures above were catalog-measured 2026-08-27 at head
`20261003004300` and are re-derived at each Record step. Two changes since are believed not to
move the count and must be **confirmed** rather than assumed: AE1.3's six doors grant
`service_role` only (so they should not enter the `authenticated` population), and
`20261003005300`'s default-privilege revoke governs **future** objects only.

⭐ **Why the ceiling is the interesting half.** The count falls only by a revoke, and **no revoke has
been executed**; it rises silently, one convenient `grant execute … to authenticated` at a time,
each individually defensible. The ceiling is what makes the aggregate a decision instead of a
by-product. ⛔ And a revoke may not create sweep blindness — revoking `authenticated` EXECUTE
removes a function from `ARM=floor`'s domain (RV0's load-bearing ruling).

### 2026-09-08 — the ceiling MOVES to 759 by PO ruling (Batch 7 ruling R24)

⛔⛔ **READ THIS BEFORE READING THE NUMBER.** `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN`
names *"editing `CEILING: 752` to 759"* as **the thing to not mistake for a fix**, because an
unruled edit *"converts a breach into a baseline"*. That prohibition is **still in force**. This
edit is legitimate for exactly one reason and would be the forbidden edit without it: **a PO
ruling exists, is dated, and is recorded** — put after the attribution above was measured, never
before. **A later reader tells the two apart by this paragraph:** an edit with no ruling recorded
beside it is the forbidden one, whatever number it carries.

**The ruling, and its stated basis.** The PO ruled **"Move the ceiling to 759"** on the measured
basis that all seven increments are attributed, **four are structurally required by live RLS policy
expressions** (which are evaluated as the *invoking* role, so the grant is not optional for them),
and **three are unproven either way** and were sent for a reachability analysis rather than
assumed. ⚠ That four/three split was **re-measured here against `pg_policies`, not carried from the
ruling's summary**: `can_edit_commission_forms` **6** policies · `can_administer_person_via_affiliation`
**3** · `current_professional_read_organizations` **1** · `is_affiliated_with_hospital` **1** · the
other three **0**. The alternative disposition the follow-up offers — *revoke the unjustified grants* — was
**not** taken; it would have reopened this unit's no-migration scope.

**The seven, each with the increment that added it** (ruling R24 requires them named beside the
move; the full attribution, with its absent-at-A / present-at-B / one-creating-statement evidence,
is the table in *"the seven are ATTRIBUTED, function by function"* above — that table is the
evidence, this list is the ruling's subject):

| # | function | increment that created **and granted** it | live RLS policies naming it |
| --- | --- | --- | ---: |
| 1 | `app.can_administer_person_via_affiliation(uuid)` | `20261003005400_ae22_person_authority_via_affiliation` | **3** |
| 2 | `app.can_edit_commission_forms(uuid, uuid)` | `20261003007300_ae49_d6_rekey_three_representatives` | **6** |
| 3 | `app.current_professional_read_organizations()` | `20261003007320_ae4_statement_scoped_authorized_scope_ids` | **1** (ADR 0182) |
| 4 | `app.is_affiliated_with_hospital(uuid)` | `20261003007000_bug_meusdados_hospitals_self_affiliation_arm` | **1** (`hospitals_select`) |
| 5 | `app.is_affiliated_with_hospital_for(uuid, uuid)` | `20261003007000_bug_meusdados_hospitals_self_affiliation_arm` | **0** |
| 6 | `app.person_has_active_org_affiliation(uuid, uuid)` | `20261003005800_ae24_inc4_linkable_picker_on_affiliations` | **0** |
| 7 | `public.recover_orphan_person_to_org(uuid, uuid, date)` | `20261003006100_adr0168_three_doors_orphan_recovery` | **0** |

**The three ZERO rows were then traced, and the trace is in
[`docs/design/authz-ae1-revoke-partition.md`](../design/authz-ae1-revoke-partition.md) § *the three
unproven grants* (ruling R25).** ⛔ *"No policy text names it"* is not itself a finding that a grant
is unjustified. Verdicts, from the closed set **REQUIRED / UNNECESSARY / UNDECIDED**: **#6
REQUIRED** · **#7 REQUIRED** · **#5 UNNECESSARY**. ⛔ **R1's defer stands and no revoke was
executed** — #5's verdict is a filed follow-up
(`FUP-AUTHZ-IS-AFFILIATED-WITH-HOSPITAL-FOR-GRANT-UNNECESSARY`), not an action, and it does
**not** lower the ceiling: the ceiling is 759 because seven arrived, not because seven are needed.

**The ceiling now has a gate.** `supabase/tests/320_act_expiry_and_acl_hardening.sql` §U4 pins the
population **per schema and in total** (`app` **326** · `public` **433** · total **759**) with a
rising control (§U5) and a two-halved falling control (§U6), and `npm run lint:budget-anchor`
(gate 15) reds if those literals and the figures in this file ever disagree. ⚠ **What that buys is
"the next Phase Gate noticed", not "the next commit noticed"** — the count needs a live catalog, so
its home is `test:db`, not the `npm run lint` chain. The follow-up's ⭐ asked for a `lint:*` step;
that ⭐ is recorded as **amended by measurement** (ruling R12), never as delivered as asked. The
gate-15 half *is* in the lint chain, but it compares two committed texts — it can never observe the
live population.

## Service-role DML registry (AE1.4; ADR 0155 Phase AE1; measured 2026-08-27)

_Every call site in `src/` that issues a write (or a write-adjacent authorization act) through
a `createAdminClient()`-constructed (service-role) Supabase client — one row per site. Like
"Zero-policy tables" above, this is a **standing registry, never a phase narrative**: it never
concludes, it is re-derived. **Owner** = the domain module responsible for the call site.
**Reason** = why the write legitimately bypasses RLS. **Revalidation mechanism** = what
re-establishes the caller's authority before the write fires (a door name, "self-scoped by
construction", "system actor: `<invariant>`", or `UNDECIDED`). **Audit event** = an audit-log
emission **visible from the TS call site only** — an explicit audit helper call, or an RPC whose
name signals logging (e.g. `log_cpf_probe_for`). ⚠ **"None found in TS" is not "unaudited"** — it
does not verify whether the target table itself carries a DB-side audit trigger (Rule 11); that
is a `pg_trigger` catalog question this registry does not attempt to answer (out of this task's
scope — see CLAUDE.md's "catalog is truth" exception). **Test** = the test that would go red if
this mechanism were removed. A blank read as passing would defeat the point of this column, so
every row states one explicitly, including "**none**" where that is the honest answer.

**Deriving instrument, re-derivation, and the diff:** `scripts/service-role-dml-census.mjs` is
the deriver (AE0.4). Reproduce with `node scripts/service-role-dml-census.mjs` (human-readable)
or `--json` (sorted, diffable); `--self-test` proves the detector can both find a known site and
be made to miss one. The diff against this table is **no longer a human comparison**: gate 11,
`npm run lint:service-role-registry` (`scripts/check-service-role-registry.mjs`), runs the census
and multiset-diffs it against the **`Key` cell of every row below**, exiting non-zero on any
delta. ⚠ **The `Key` column is the machine-readable registry** — `path::symbol::writeKind::target`,
never the line number, which is volatile. It lives in the same row as the prose so the two cannot
drift into separate copies; edit a row's key only because the *site* changed. A table added
without a `Key` header column, a row whose key will not parse, and a parse yielding **zero** keys
are each their own red — an empty parse must never read as a clean diff.

⚠ **Comparison is a MULTISET, not a set.** Two rows may legitimately share one identity —
`assignOrgAdmin` calls `grant_role_for` twice (org tier, single-hospital auto-seat) — and a set
comparison would let one of them be deleted without a red.

⛔ **The census under-counts by design, and the gate corrects for it — do not read its
`IN_SCOPE` total as the site count.** The census detects *member* calls (`client.rpc('name')`).
AE1.3 introduced **`callDoor(client, 'name', args)`** (`src/lib/types/rpc-args.ts`), a *free*
function that widens the generated arg types to admit an explicit NULL — so five real
service-role door calls became invisible to it. What it reports instead is **one** row for the
wrapper's own inner `client.rpc(fn, …)`, target `<dynamic:fn>`, naming only the first
service-role caller it happens to find. That single row stands in for N call sites. The gate
therefore **drops the placeholder and derives the five real sites from source**, and asserts the
substitution in *both* directions (placeholder with no derived site, or derived sites with no
placeholder, are each a red), so the expansion rule cannot go stale silently. A `callDoor` whose
client or function-name argument cannot be resolved is a hard failure, never a silent skip.

Re-derived 2026-08-27 at commit `599920e0` (**post-AE1.3**): **44 sites** = census `IN_SCOPE` 40
− 1 wrapper placeholder + 5 `callDoor` expansions. Composition: 3 `from-verb` + 27 `rpc` + 6
`storage` + 4 `storage-sign` + 4 `auth-admin` = 44 — census self-test PASS, gate self-test PASS.

✅ **AE1.3 HAS LANDED** (it had not at the previous measurement, commit `e7c26068`). All six
person-authority doors exist and Group A's nine raw-DML rows are gone: seven converted to door
calls, and `upsertCredential`'s update+insert **pair consolidated into one** `upsert_credential_for`
call — 9 rows out, 8 in. The doors are now the authority; the TS `authorizePersonScopedAdmin` →
`personScopeAllows` guards are kept as defense-in-depth and a friendlier pt-BR message, per plan.
⚠ Five of the eight are reached through `callDoor`, i.e. **invisible to the raw census** — the
paragraph above is what keeps them in this table.

### Group A — person-authority `profiles` / `professional_credentials` (8 sites; AE1.3 doors, LANDED)

`personScopeAllows(capability, footprint, administeredHospitalIds)` (`src/lib/users/person-scope.ts`)
is the shared TS predicate still invoked ahead of every row below via
`authorizePersonScopedAdmin(userId, capability)` in `src/lib/users/actions.ts`; capabilities are
`'fields' | 'credentials' | 'cpf_change' | 'lifecycle'`. Since AE1.3 those calls are
**defense-in-depth and the pt-BR message**, not the authority — the door is.

⚠ **What "door: `X`" is evidence of here.** The door NAME is measured from the TS call site (and
`src/lib/types/database.ts`, which only exists because the function does). That each body
*re-derives* the caller's authority rather than trusting the `p_actor` it is handed is a
`pg_proc`/`prosrc` question this registry **does not answer** — the same standing caveat Group D
carries. Do not quote a row here as proof the SQL predicate is correct.

⛔ **Five of these eight are reached through `callDoor(...)` and are therefore INVISIBLE to a raw
census run** — marked `[via callDoor]`. See the expansion paragraph above; gate 11 derives them.

| Key | Site | Owner | Reason (service-role need) | Revalidation mechanism | Audit event | Test that would notice the guard vanish |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/users/actions.ts::deactivateUser::rpc::set_person_active_for` | `users/actions.ts:deactivateUser` → rpc `set_person_active_for` | users | admin deactivates another person's account; RLS has no cross-person write path | **door: `set_person_active_for`**; TS defense-in-depth: `authorizePersonScopedAdmin(userId,'lifecycle')` (SUBSET) | none found in TS | **YES** — `d14-person-level.test.ts` §1 (allowed, sole footprint), §2 (**denied**, cross-hospital), §4, §6 (org_admin twin) + `e2e/hospital-admin-tier.spec.ts` (Desativar) |
| `src/lib/users/actions.ts::reactivateUser::rpc::set_person_active_for` | `users/actions.ts:reactivateUser` → rpc `set_person_active_for` | users | same as above, reverse direction; the SAME door serves both so `is_active` and `suspended_until` cannot drift apart | **door: `set_person_active_for`**; TS d-i-d: same call, `'lifecycle'` | none found in TS | **YES, with a caveat** — §1 (allowed) + §6 cited explicitly; the DENY arm is not separately named for `reactivateUser` in the reported coverage, but it is the **identical** `authorizePersonScopedAdmin(id,'lifecycle')` call that `deactivateUser`'s §2 deny-arm exercises — an incidental guard closing a hole the definition predicts, not an independently-proven one. Flag for a dedicated reactivate-deny arm. |
| `src/lib/users/actions.ts::suspendUser::rpc::suspend_person_for` | `users/actions.ts:suspendUser` → rpc `suspend_person_for` `[via callDoor]` | users | same predicate family, suspension arm | **door: `suspend_person_for`** — deliberately a SEPARATE door from `set_person_active_for`, so suspension cannot silently widen into deactivation; TS d-i-d: `'lifecycle'` | none found in TS | **YES** — §1, §2 (denied), §6 + `e2e/user-registration.spec.ts` (Suspender/"Confirmar suspensão") + `e2e/hospital-admin-tier.spec.ts` |
| `src/lib/users/actions.ts::updateUserProfile::rpc::update_person_fields_for` | `users/actions.ts:updateUserProfile` → rpc `update_person_fields_for` (fields + `cpf_change` arm, one door) `[via callDoor]` | users | admin edits another person's profile fields; CPF change escalates to a tighter bound | **door: `update_person_fields_for`** — carries BOTH bounds (`fields` INTERSECTION always, `cpf_change` SUBSET only when the CPF actually changes). ⚠ The `p_set_*` booleans carry the absent-key-vs-explicit-NULL distinction the old spread form carried; collapsing the pair would let an edit form that omits a field NULL IT OUT (ADR 0133 D9/D10, pinned pgTAP `385` §1.7). TS d-i-d: `'fields'` + `'cpf_change'` | none found in TS | **YES, thorough** — §1–§6 (sole/cross-hospital/whole-footprint/tier/sibling, CPF-presence-vs-change semantics) + `person-scope.test.ts` (predicate directly) + `e2e/hospital-admin-tier.spec.ts`, `e2e/aff2-scope-rule.spec.ts` |
| `src/lib/users/actions.ts::upsertCredential::rpc::upsert_credential_for` | `users/actions.ts:upsertCredential` → rpc `upsert_credential_for` — **ONE call; the pre-AE1.3 update-row + insert-row pair consolidated into it** `[via callDoor]` | users | admin edits an existing credential row for another person, or adds a new one | **door: `upsert_credential_for`**; TS d-i-d: `'credentials'` (INTERSECTION). The door RAISES `HC0T6` on a write that matched nothing rather than returning silent success, so there is no "salvo" message for a write that never happened | none found in TS | **YES** — `d14-person-level.test.ts` §1, §2, §4 (denied, expired-seat fixture). The former separate insert row shared this guard and this suite; one call site now, one row |
| `src/lib/users/actions.ts::removeCredential::rpc::delete_credential_for` | `users/actions.ts:removeCredential` → rpc `delete_credential_for` | users | admin deletes another person's credential row | **door: `delete_credential_for`**; TS d-i-d: `'credentials'`. ⚠ Deliberately the OPPOSITE no-match shape from `upsert_credential_for`'s update arm | none found in TS | **YES** — §1, §6 ("`removeCredential` must carry its OWN arm" — reported verbatim) |
| `src/lib/users/actions.ts::registerUser::rpc::finalize_invited_person_for` | `users/actions.ts:registerUser` → rpc `finalize_invited_person_for` (invite-flow profile patch) `[via callDoor]` | users | sets initial profile fields for a newly invited/registered person | **door: `finalize_invited_person_for`**; TS: entry gate only — session + `isOrgAdminCaller`/hospital-resolution check (**not** `personScopeAllows`). ⚠ **This cell read, until AE2:** *"`home_organization_id` is deliberately NOT in the column list: `handle_new_user` seeds it, and writing it would fire the deferred `profiles_tenant_has_org_trg`"* — **both halves are now false and the reason the column is absent has changed**: the column is DROPPED, `handle_new_user` seeds nothing, and `profiles_tenant_has_org_trg` no longer exists (`20261003005600`). The kernel's measured column list is `full_name` · `professional_category_id` · `cpf` · `date_of_birth` · `phone` · `must_change_password`; the org association is now written by the **creation door** (`affiliate_new_person_to_org_for`), a separate registry row. Its own gate is `app.can_administer_person_for('cpf_change', …)` — the SUBSET bound, not the intersection one | none found in TS | **UNCONFIRMED** — extensive d14 coverage of payload/routing correctness for authorized callers; no explicit assertion surfaced that an unauthenticated/non-admin caller is REJECTED at this entry gate specifically, and none names the door's own deny arm either |
| `src/lib/users/actions.ts::registerUser::rpc::upsert_credential_for` | `users/actions.ts:registerUser` → rpc `upsert_credential_for` (looped over the initial credentials) `[via callDoor]` | users | seeds the new person's initial credential(s) at registration time | **door: `upsert_credential_for`** — the same door `upsertCredential` uses, reached from the registration path under the shared entry gate (not `'credentials'`/`personScopeAllows`; registration is a different code path) | none found in TS | **UNCONFIRMED** — same caveat as the row above |

### Group B — self-scoped by construction (1 site)

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/auth/actions.ts::updatePassword::update::profiles` | `auth/actions.ts:updatePassword` → update `profiles.must_change_password` | auth | clears the caller's OWN forced-change flag; needs service-role because the column is service-role-only writable (`guard_profile_privileged_columns`) | **self-scoped by construction** — `.eq('id', user.id)` where `user.id` comes from `supabase.auth.getUser()` on the SAME request, after `supabase.auth.updateUser({password})` succeeded. AE1.3 deliberately excludes this site ("converting it adds a door with no second principal") | none found in TS | **NONE, effectively** — `page.test.tsx` only stubs `updatePassword: vi.fn()` (doesn't exercise the real function); the one e2e round-trip (`e2e/user-registration.spec.ts`, invite-mode) is `test.skip`'d by default (needs `AUTH_EMAIL_VERIFICATION=on`) |

### Group C — system actor: `meeting_minutes_jobs` lifecycle (4 sites)

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/minutes-jobs/reconcile.ts::deleteAudio::storage-remove::<dynamic:MEETING_AUDIO_BUCKET>` | `minutes-jobs/reconcile.ts:deleteAudio` → storage-remove (`MEETING_AUDIO_BUCKET`) | minutes-jobs | cleans up audio after job reconciliation; reached only after an RLS-scoped read (`app.is_staff_admin_of`) in `queries.ts` already gated the caller | **system actor: reconciliation runs only for a job the caller could already read under RLS** — no in-function check | none found in TS | **NONE** — no `reconcile.test.ts`; symbol not in any `*.test.ts` |
| `src/lib/minutes-jobs/reconcile.ts::deleteAudio::update::meeting_minutes_jobs` | `minutes-jobs/reconcile.ts:deleteAudio` → update `meeting_minutes_jobs` | minutes-jobs | same reconciliation, status flip | same as above | none found in TS | **NONE** — same absence |
| `src/lib/minutes-jobs/sweep.ts::sweepStaleAudio::storage-remove::<dynamic:MEETING_AUDIO_BUCKET>` | `minutes-jobs/sweep.ts:sweepStaleAudio` → storage-remove (`MEETING_AUDIO_BUCKET`) | minutes-jobs | TTL-based stale-audio sweep; explicitly "row-agnostic on purpose" | **system actor: cron/webhook-invoked, no end-user session; the only self-protection is an in-process throttle (`SWEEP_THROTTLE_MS`), a rate-limit not an authz guard** | none found in TS | **YES** — `sweep.test.ts` asserts the exact `list_stale_meeting_audio` call args, the single batched `remove()`, and that `audio_deleted_at` is stamped only for storage-confirmed removals |
| `src/lib/minutes-jobs/sweep.ts::sweepStaleAudio::update::meeting_minutes_jobs` | `minutes-jobs/sweep.ts:sweepStaleAudio` → update `meeting_minutes_jobs` | minutes-jobs | same sweep, status flip | same as above | none found in TS | **YES** — same test |

### Group D — pre-existing doors (`.rpc()`, decided; 8 sites)

Pre-existing `memberships`/`hospital_affiliations` `_for` doors (ADR 0094/0097/0098), outside
AE1.3's *person*-authority scope. `actorValidating` is recorded `UNRESOLVED (SQL body not read)`
by the census for every row here — the JS-side `_for`-suffix + explicit-`p_actor` heuristic is
evidence the call site passes an actor, never a verdict that the SQL predicate re-derives
authority rather than trusting it; that verification is a `pg_proc`/`prosrc` read this registry
does not perform.

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/admin/actions.ts::assignStaffAdmin::rpc::grant_role_for` | `admin/actions.ts:assignStaffAdmin` → rpc `grant_role_for` (commission-tier `staff_admin` grant) | admin | ⭐ **moved off the SESSION door by ADR 0168 Amdt 3**, not a new privilege: `app.grant_role_impl` calls `app.ensure_provisioned_org_affiliation`, which anchors the target to the commission's org (ADR 0166) and admitted an ANCHORLESS person — so via `public.grant_role` an `org_admin` holding only an orphan's uuid could anchor them AND grant a role (live-probed, accepted). Amdt 3 leaves that admission only on the `service_role` twin, which this path needs because `resolveOrInviteUser` may have just invited the person | door: `grant_role_for` — re-derives the SAME authority in PostgreSQL from `p_actor`, so the move trades no authority; TS gate: `authorizeStaffAdminOps(commissionId)` (org_admin of the commission's org OR hospital_admin of its hospital — ⚠ NOT platform_admin) | none found in TS | **YES** — `396 § 2.1` drives this exact shape, and Amdt 3's new cell asserts the SESSION door now refuses the same call `HC0R0`; the twin-asymmetry pin reds if anyone "restores symmetry" |
| `src/lib/platform/actions.ts::assignOrgAdmin::rpc::grant_role_for` | `platform/actions.ts:assignOrgAdmin` → rpc `grant_role_for` (org-tier grant) | platform | grants `org_admin` for a caller who isn't the target's own session | door: `grant_role_for` (pre-existing); TS gate: `requireAdmin()` via `getSessionContext()?.isAdmin` | none found in TS (relies on the door's DB-side trigger, unverified here) | **YES** — `e2e/platform-org-admin-provisioning.spec.ts` (MEM2-1/2/3; asserts `granted_by` attribution, idempotency, platform-only access) |
| `src/lib/platform/actions.ts::assignOrgAdmin::rpc::grant_role_for` | `platform/actions.ts:assignOrgAdmin` → rpc `grant_role_for` (single-hospital auto-seat of `hospital_admin`) | platform | auto-seats `hospital_admin` when the new org has exactly one hospital | door: `grant_role_for`; TS gate: same `requireAdmin()`, no additional check | none found in TS | **NONE** — no test asserts the auto-seat branch; no `src/lib/platform/**/*.test.ts` exists |
| `src/lib/users/actions.ts::assignCommitteeRole::rpc::grant_role_for` | `users/actions.ts:assignCommitteeRole` → rpc `grant_role_for` | users | grants a per-commission committee role | door: `grant_role_for`; TS gate: `authorizeForUser(userId)` AND `authorizeForCommission(commissionId)` (not `personScopeAllows`) | none found in TS | **NONE dedicated** — incidental-only `e2e/user-registration.spec.ts` ("Adicionar comissão") exercises the UI path, not a guard keystone |
| `src/lib/users/actions.ts::ensureActiveAffiliation::rpc::affiliate_new_person_for` | `users/actions.ts:ensureActiveAffiliation` → rpc `affiliate_new_person_for` | users | affiliates a person to a hospital during registration | door: `affiliate_new_person_for` (the CREATION door, ADR 0168 Amdt 1/2); TS gate: none in this (unexported, private) helper — `registerUser` authorizes before calling it | none found in TS | **YES, indirect** — `d14-person-level.test.ts` §9 asserts the RPC call + `p_started_on` payload + `e2e/aff4-registration-dates.spec.ts`, `e2e/aff-hospital-affiliation.spec.ts` |
| `src/lib/users/actions.ts::registerUser::rpc::affiliate_new_person_to_org_for` | `users/actions.ts:registerUser` → rpc `affiliate_new_person_to_org_for` | users | affiliates a person at the ORG tier (org_admin registrants only) | door: `affiliate_new_person_to_org_for` (the CREATION door, ADR 0168 Amdt 1/2); TS gate: entry gate **plus** `if (isOrgAdminCaller)` — a hospital_admin registrant must never reach this door | none found in TS | **YES** — §9 explicitly: "hospital_admin registrar NOT calling the org door" — a genuine guard-removal keystone |
| `src/lib/users/actions.ts::registerUser::rpc::log_cpf_probe_for` | `users/actions.ts:registerUser` → rpc `log_cpf_probe_for` | users | records a CPF-collision probe as a compensating control for the CPF-uniqueness oracle | door: `log_cpf_probe_for`; TS gate: entry gate only, fires unconditionally on match/no-match | **YES — the one explicit audit mechanism in this whole registry**, doc'd as "the compensating control for the [CPF] oracle" | **YES** — §9 asserts the probe call fires and never carries raw CPF digits |
| `src/lib/users/actions.ts::registerUser::rpc::grant_role_for` | `users/actions.ts:registerUser` → rpc `grant_role_for` (committee grants, looped) | users | seats the new person on 0+ committees at registration | door: `grant_role_for`; TS gate: entry gate + per-committee `allWithinHospital` (non-org-admin callers) | none found in TS | **NONE** — reported explicitly: "No arm directly exercises site 7 (`grant_role_for` for committees) inside `registerUser`" |
| `src/lib/users/actions.ts::removeCommittee::rpc::revoke_role_for` | `users/actions.ts:removeCommittee` → rpc `revoke_role_for` | users | removes a per-commission committee role | door: `revoke_role_for`; TS gate: `authorizeForUser` + `authorizeForCommission` (same pair as `assignCommitteeRole`) | none found in TS | **NONE dedicated** — incidental-only `e2e/user-registration.spec.ts` ("Remover de Comissão...") |

### Group E — RULED 2026-08-27 (11 `.rpc()` sites; formerly `UNDECIDED`)

PO-ruled 2026-08-27, approved as-is with four observations →
[authz-ae1-rpc-rulings.md](../design/authz-ae1-rpc-rulings.md) (evidence: live-catalog bodies +
ACLs; local↔remote **body-md5 parity, exact**; zero references to these functions in the
unregistered migrations — the R3 discharge). One site re-classified as an **in-function
door**, ten as **system actor**. Riders: **R1** ACL pins = pgTAP `388` §1; **R2** HMAC deny
test = `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` (a *condition* of the `complete_minutes_job`
ruling); **R3** discharged at recording. History, kept because it was the honest state for a
day: these rows were `UNDECIDED` because no actor argument, self-scoped shape, or
system-actor justification was visible **from the call site** — the rulings derive each
mechanism from the function bodies instead, and record what guards each premise.

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/documents/actions.ts::finalizeDocumentUpload::rpc::complete_evidence_upload_verification` | `documents/actions.ts:finalizeDocumentUpload` → rpc `complete_evidence_upload_verification` | documents | finalizes an evidence upload after client-side hash verification | **door (in-function)** — actor re-derived from `upload_sessions.reserved_by` (NULL refused) → `app.can_write_rca`/`can_write_capa` **before any write**; ruled 2026-08-27 → [rulings §1](../design/authz-ae1-rpc-rulings.md) | none in TS; **in-function, catalog-measured 2026-08-27:** `document.uploaded`/`document.upload_failed` (via the delegated verifier) | **YES** — `actions.test.ts` (MAJOR-3) terminal-state/ordering + pgTAP `388` §1 (ACL pin: service_role-only) |
| `src/lib/documents/actions.ts::finalizeDocumentUpload::rpc::complete_document_upload_verification` | `documents/actions.ts:finalizeDocumentUpload` → rpc `complete_document_upload_verification` | documents | same finalize step, non-evidence path | **system actor:** completion of a `consumed` upload session — single-transition state machine keyed by session id; authority spent at the user-session door `finalize_document_upload`; ruled → [rulings §2](../design/authz-ae1-rpc-rulings.md) | none in TS; **in-function, catalog-measured 2026-08-27:** `document.uploaded`/`document.upload_failed` | **YES** — same test + pgTAP `388` §1 |
| `src/lib/documents/actions.ts::reclassifyDocument::rpc::complete_document_reclassification` | `documents/actions.ts:reclassifyDocument` → rpc `complete_document_reclassification` | documents | records a completed reclassification after the storage copy | **system actor:** completion keyed to a `reserved` file object minted by the user-session door `reclassify_document`; sha + same-document + storage-presence preconditions in-function; ruled → [rulings §3](../design/authz-ae1-rpc-rulings.md); op-id binding = `FUP-DOC-RECLASS-OPERATION-ID` | none in TS; **in-function, catalog-measured 2026-08-27:** `document.reclassified` | pgTAP `388` §1 (ACL pin); behavioral coverage still **NONE** — unchanged by the ruling |
| `src/lib/documents/actions.ts::reclassifyDocument::rpc::complete_document_disposal` | `documents/actions.ts:reclassifyDocument` → rpc `complete_document_disposal` | documents | records a disposal after the old file is removed | **system actor:** records an **already-performed** storage deletion for a file already `disposal_pending`; closed byte-proof vocabulary + retention block + absence verification in-function; ruled → [rulings §4](../design/authz-ae1-rpc-rulings.md); provenance split = `FUP-DOC-DISPOSAL-PROVENANCE-SPLIT` | none in TS; **in-function, catalog-measured 2026-08-27:** `document.disposed` (+ `document.retention_override` on exemption lanes) | pgTAP `388` §1 (ACL pin); behavioral coverage still **NONE** — unchanged by the ruling |
| `src/lib/minutes-jobs/actions.ts::failAndCleanUp::rpc::fail_minutes_job` | `minutes-jobs/actions.ts:failAndCleanUp` → rpc `fail_minutes_job` | minutes-jobs | marks a job failed during internal cleanup | **system actor:** terminal transition (`uploading`/`processing` → `failed`), latch **atomic in the UPDATE** since `20261003005000`; this path's gate = the caller's own RLS-scoped setup in `submitMinutesJob`; ruled → [rulings §5–7](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `minutes_job.failed` | **YES** — pgTAP `388` §2–3 (latch behavior + atomicity pins) |
| `src/lib/minutes-jobs/reconcile.ts::failJob::rpc::fail_minutes_job` | `minutes-jobs/reconcile.ts:failJob` → rpc `fail_minutes_job` | minutes-jobs | marks a job failed during page-load reconciliation | **system actor:** same atomic terminal transition; this path's gate = the `staff_admin`-gated RLS read (Group C); ruled → [rulings §5–7](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `minutes_job.failed` | **YES** — pgTAP `388` §2–3 |
| `src/lib/minutes-jobs/sweep.ts::sweepStaleAudio::rpc::list_stale_meeting_audio` | `minutes-jobs/sweep.ts:sweepStaleAudio` → rpc `list_stale_meeting_audio` | minutes-jobs | lists TTL-expired jobs to sweep | **system actor:** cron sweep input; read-only, bounded (limit ≤ 1000, age ≥ 1 h); ruled → [rulings §9](../design/authz-ae1-rpc-rulings.md) | none found in TS (read-only) | **YES** — `sweep.test.ts` pins the exact call args + pgTAP `388` §1 (ACL pin) |
| `src/lib/minutes-jobs/webhook.ts::failJob::rpc::fail_minutes_job` | `minutes-jobs/webhook.ts:failJob` → rpc `fail_minutes_job` | minutes-jobs | marks a job failed on a provider callback | **system actor:** same atomic terminal transition; this path's gate = the HMAC-verified route (`verifyCallbackSignature`) — **R2 condition:** `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST`; ruled → [rulings §5–7](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `minutes_job.failed` | pgTAP `388` §2–3 for the RPC half; ✅ **route half LANDED 2026-08-27** — `src/app/api/webhooks/audio-jobs/route.rpc-boundary.test.ts` asserts the RPC is **not called** on a bad/absent signature and *is* called on a good one, red-first proven (gate neutralized → 7 failed / 3 passed, the 3 being the positive controls). `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` is RESOLVED → `follow-ups-archive.md` |
| `src/lib/minutes-jobs/webhook.ts::handleMeetingMinutesCallback::rpc::complete_minutes_job` | `minutes-jobs/webhook.ts:handleMeetingMinutesCallback` → rpc `complete_minutes_job` | minutes-jobs | completes a job on a provider callback | **system actor:** provider-callback completion; sole caller = the HMAC-verified route (**R2 condition:** `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST`); `processing` → `done` latch **atomic** since `20261003005000`; ruled → [rulings §8](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `minutes_job.completed` | pgTAP `388` §2–3 for the RPC half; ✅ **route half LANDED 2026-08-27** — `src/app/api/webhooks/audio-jobs/route.rpc-boundary.test.ts` asserts the RPC is **not called** on a bad/absent signature and *is* called on a good one, red-first proven (gate neutralized → 7 failed / 3 passed, the 3 being the positive controls). `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` is RESOLVED → `follow-ups-archive.md` |
| `src/lib/queries/feature-flags.ts::<anonymous function>::rpc::get_feature_flags` | `queries/feature-flags.ts:getFeatureFlagsServerOnly` → rpc `get_feature_flags` | queries | reads flags for session-less server surfaces (`/verificar`, the audio-jobs webhook) | **system actor:** read-only global flag projection; the grant layer is the control (`authenticated` + `service_role`, `anon` excluded — pinned pgTAP `388` §1); ruled → [rulings §10](../design/authz-ae1-rpc-rulings.md) | none found in TS (read-only) | pgTAP `388` §1 (grant pin); `route.test.ts` still mocks this reader wholesale — unchanged by the ruling |
| `src/lib/queries/printed-documents.ts::lookupPrintedDocumentVerification::rpc::lookup_printed_document` | `queries/printed-documents.ts:lookupPrintedDocumentVerification` → rpc `lookup_printed_document` | queries | public verification-code lookup (ADR 0104 D10, deliberately anonymous *at the surface* — `anon` has NO EXECUTE; the server mediates) | **system actor (designed public surface):** `consumeLookupBudget` precedes every call; ⚠ **WRITE-BEARING** — every call inserts a `verification_lookups` row (hash-only; **audit-retention owner: the documents/printing domain**); invariant: `p_viewer` is always session-derived; ruled → [rulings §11](../design/authz-ae1-rpc-rulings.md) | none in TS; in-function (catalog-measured): `verification_lookups` insert on every call, matched or not | **YES** — `printed-documents.test.ts` (budget-before-RPC) + `printed-documents-caller-census.test.ts` (exactly-one-caller + budget-precedes-RPC pins) + pgTAP `388` §1 |

### Group F — Storage writes, RPC-preceded (4 sites)

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/documents/actions.ts::reclassifyDocument::storage-upload::<dynamic:newFile.storage_bucket>` | `documents/actions.ts:reclassifyDocument` → storage-upload (new file, dynamic bucket) | documents | copies the object to its new classification's path (Rule 6: never overwrite, new path per upload) | authority established by the preceding `reclassify_document` RPC succeeding; no separate check at the storage call | none found in TS | **NONE** — no test references `reclassifyDocument`'s storage ops at all |
| `src/lib/documents/actions.ts::reclassifyDocument::storage-remove::<dynamic:oldFile.storage_bucket>` | `documents/actions.ts:reclassifyDocument` → storage-remove (old file) | documents | removes the superseded object after the copy | same as above | none found in TS | **NONE** — same absence |
| `src/lib/pdf-mint/actions.ts::mintPrintedDocument::storage-upload::<dynamic:bucket>` | `pdf-mint/actions.ts:mintPrintedDocument` → storage-upload | pdf-mint | writes the minted PDF bytes; authority is "anyone who can VIEW the source artifact," enforced by the `mint_printed_document` door called AFTER this upload | upload happens BEFORE the door call; on door failure the object is deleted (compensating cleanup, not a pre-write guard) | none found in TS | **NONE** — `compare-and-mint.test.ts` covers the ADR 0126 revision contract, not authorization/ordering of the storage ops |
| `src/lib/pdf-mint/actions.ts::mintPrintedDocument::storage-remove::<dynamic:bucket>` | `pdf-mint/actions.ts:mintPrintedDocument` → storage-remove (compensating cleanup on RPC failure) | pdf-mint | undoes the upload above if minting fails | same as above | none found in TS | **NONE** — same caveat |

### Group G — Storage sign-upload, `createSignedUploadUrl` (4 sites; the family AE0.4 found unnamed)

Mints upload *capability* rather than writing bytes. All four share one shape: a user-session RPC
(`begin_document_upload` / `create_minutes_job`) runs first and is the real gate; only on success
does the admin client mint a signed URL. None has a TS-side authorization check of its own to lose.

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/documents/actions.ts::beginDocumentUpload::storage-sign-upload::<dynamic:file.storage_bucket>` | `documents/actions.ts:beginDocumentUpload` → `<dynamic:file.storage_bucket>` | documents | mints a signed PUT target after `begin_document_upload` establishes the caller may write this resource | RPC-preceded; no in-function check | none found in TS | **NONE dedicated** — `e2e/phase-f2-attachments.spec.ts` drives the real corridor (happy path), not a guard/deny keystone |
| `src/lib/minutes-jobs/actions.ts::startMinutesJob::storage-sign-upload::<dynamic:MEETING_AUDIO_BUCKET>` | `minutes-jobs/actions.ts:startMinutesJob` → `MEETING_AUDIO_BUCKET` | minutes-jobs | mints a signed PUT target after `create_minutes_job` succeeds; comment: "the RPC runs FIRST so an unauthorized caller never causes a storage object to be signed for" | RPC-preceded; no in-function check (client-side size/type ceilings are "a courtesy, never the control") | none found in TS | **NONE dedicated** — `e2e/meeting-audio-minutes.spec.ts` drives the real signed-PUT flow (happy path) |
| `src/lib/safety/capa-actions.ts::beginCapaEvidenceUpload::storage-sign-upload::<dynamic:file.storage_bucket>` | `safety/capa-actions.ts:beginCapaEvidenceUpload` → `<dynamic:file.storage_bucket>` | safety (CAPA) | mints a signed PUT for CAPA evidence after `begin_document_upload(p_resource_type:'capa_action')` resolves via `app.can_write_capa` | RPC-preceded; no in-function check | none found in TS | **NONE for the TS wrapper** — `e2e/dm5-nsp-evidence.spec.ts` has its own helper calling the RPC directly (exercises the door, not this wrapper) |
| `src/lib/safety/rca-actions.ts::beginRcaEvidenceUpload::storage-sign-upload::<dynamic:file.storage_bucket>` | `safety/rca-actions.ts:beginRcaEvidenceUpload` → `<dynamic:file.storage_bucket>` | safety (RCA) | same shape, `app.can_write_rca` | RPC-preceded; no in-function check | none found in TS | **NONE for the TS wrapper** — `e2e/phase14c-rca.spec.ts` has its own like-named helper calling the RPC directly, not this wrapper |

### Group H — Auth-admin (4 sites)

| Key | Site | Owner | Reason | Revalidation mechanism | Audit event | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/users/actions.ts::registerUser::auth-admin-createUser::createUser` | `users/actions.ts:registerUser` → `auth.admin.createUser` | users | creates the auth identity when email verification is off | shared `registerUser` entry gate only (see Group A) | none found in TS | **UNCONFIRMED** — same entry-gate caveat as Group A |
| `src/lib/users/actions.ts::registerUser::auth-admin-inviteUserByEmail::inviteUserByEmail` | `users/actions.ts:registerUser` → `auth.admin.inviteUserByEmail` | users | invites the new user when email verification is on | shared entry gate only | none found in TS | **UNCONFIRMED** — same caveat |
| `src/lib/members/invite.ts::resolveOrInviteUser::auth-admin-inviteUserByEmail::inviteUserByEmail` | `members/invite.ts:resolveOrInviteUser` → `auth.admin.inviteUserByEmail` `[INDIRECT — Tier 2]` | members | resolves-or-invites during org/platform admin flows; doc'd as performing "NO authorization of its own — the calling action is the authority" | the one check present is a tenant-anchor guard, not caller authorization. ⚠ **Re-derived at AE2 — this cell described `if (existing.home_organization_id !== homeOrganizationId) throw`, which is no longer the code.** The parameter is now `organizationId` (used ONLY by this check) and the guard is **two arms**, mirroring the *creation* door's predicate rather than a column compare: refuse if `existing.is_admin`, then refuse if the person holds non-voided org affiliations and **none** is `organizationId`. ⛔ **NON-VOIDED, not ACTIVE** — matching `app.person_known_to_org`, so a rehire is not refused. An anchorless person (zero affiliations) now **passes**, which is the deliberate widening: under the old column a `platform_admin` was refused because their anchor was NULL. `organizationId` is **no longer seeded into `user_metadata`** | none found in TS | **YES** — `invite.test.ts` ("the D13 tenant check"), 4 arms incl. cross-org refuse, and the anchorless arm re-polarised at AE2.4 |
| `src/lib/users/actions.ts::resendInvite::auth-admin-inviteUserByEmail::inviteUserByEmail` | `users/actions.ts:resendInvite` → `auth.admin.inviteUserByEmail` | users | re-sends an invite email | TS: `authorizeForUser(userId)` — deliberately NOT `personScopeAllows` (doc'd: would wrongly import the D2 tier bound) | none found in TS | **YES** — `d14-person-level.test.ts` §7, 4 arms incl. "sibling hospital_admin refused" |

### Summary

**44/44 re-derived post-AE1.3, machine-checked by gate 11.** Family totals: 3 `from-verb`
(1 Group B + 2 Group C) + 27 `rpc` (8 Group A + 8 Group D + 11 Group E) + 6 `storage` (2 Group C
+ 4 Group F) + 4 `storage-sign` (Group G) + 4 `auth-admin` (Group H) = 44.

⚠ **Raw DML is now only 3 of 44 sites.** AE1.3 took the whole of Group A behind doors, so the
service-role surface is overwhelmingly `.rpc()`: the only remaining raw table writes are
`updatePassword` (Group B, self-scoped) and the two `meeting_minutes_jobs` status flips
(Group C). AE0.4's "12 raw-DML vs 33 other" split no longer describes this registry and is
retired rather than re-fitted.

⚠ **Test coverage, re-derived row by row** — classified by each row's LEADING verdict token, so
the rule is stated rather than assumed: **20 `YES`** · **5 `PARTIAL`** · **15 `NONE`** ·
**4 `UNCONFIRMED`** = 44. So **19 rows (43%) have no test at all** that would notice their
mechanism vanish, and **24 (55%)** are not fully covered once the `PARTIAL` half-gaps are counted.
The 5 `PARTIAL` rows all sit in Group E and share one shape — a pgTAP `388` ACL/latch pin exists,
the behavioral or route half does not: `reclassifyDocument` ×2 (ACL pinned, behavioral `NONE`),
the two webhook rows (RPC half pinned; ✅ **route half LANDED 2026-08-27**, `FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` RESOLVED — ⚠ this sentence read *"route half `NONE` until the FUP lands"* while the rows it summarises already said otherwise: **prose stale against its own table**, the same shape as the figures above
lands), and `get_feature_flags` (grant pinned, reader still mocked wholesale). The 4 `UNCONFIRMED`
are one shape too — `registerUser`'s shared entry gate, whose denial path was not found in the
reported coverage and is **not proven absent** (2 in Group A, 2 in Group H). This is a measured
property of the platform, not a gap in this review pass.

⛔ **This tally corrects the previous one, which did not reconcile.** AE1.4 recorded
`19 YES / 22 NONE / 4 UNCONFIRMED` over 45 rows; re-derived under the rule above, that same 45-row
table was `21 YES / 20 NONE / 4 UNCONFIRMED` — two rows leading with **YES** had been tallied as
`NONE`, and the `PARTIAL` shape was collapsed into `NONE` unstated. Only the AGGREGATE was wrong;
every per-row verdict cell was and is correct. ⛔ Re-derive this paragraph from the rows whenever
the table changes — never adjust the numbers arithmetically, which is how a direction gets fixed
while the magnitude stays wrong.

**The 11 formerly-`UNDECIDED` sites were RULED 2026-08-27** — approved as-is with four PO
observations → [authz-ae1-rpc-rulings.md](../design/authz-ae1-rpc-rulings.md) (Group E carries
the ruled mechanism strings). Zero `undecided` dispositions remain — **still zero after the
post-AE1.3 re-derivation**: the eight rows Group A gained are all decided (doors), and no row
anywhere in this registry carries `UNDECIDED`. Gate AE1 condition `[PA-F10]` now has both halves —
the registry is re-derived, and the derivation-vs-registry diff is a **machine** check
(`npm run lint:service-role-registry`), not the human comparison AE1.4 shipped with. The
observations produced: migration `20261003005000` (atomic
minutes-job latches) + pgTAP `388` (R1 ACL pins, latch behavior, atomicity text-pins) +
`printed-documents-caller-census.test.ts` (obs #4), and three filed FUPs
(`FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST` = R2 · `FUP-DOC-RECLASS-OPERATION-ID` ·
`FUP-DOC-DISPOSAL-PROVENANCE-SPLIT`).

## AE3 — restricted personal details leave `profiles` (2026-08-31; ADR **0155** D4; migrations `20261003006600`–`…006800`, **3**; pgTAP `301` `plan(44)` · `359` `plan(30)` · `361` · `379` · `382` `plan(83)` · `385` · `386` · `393`; **NO flag — the migrations ARE the cutover**; QA r1 CHANGES REQUESTED → addressed, re-review owed) — ⛔ **NOT PUSHED: local only**

⛔ **Re-measure before quoting** — `origin/main..main` and the remote head are facts about a moment.
Cutover procedure: [`deployment/ae3-cutover-runbook.md`](../deployment/ae3-cutover-runbook.md).

**New table — `public.profile_private_details`.** `profile_id uuid` PK, FK → `profiles(id)`
`ON DELETE CASCADE`; `cpf text`, `date_of_birth date`, `phone text`, `updated_at timestamptz NOT NULL
DEFAULT now()`. Constraint `profile_private_details_cpf_valid` (`cpf IS NULL OR app.is_valid_cpf(cpf)`)
and index `profile_private_details_cpf_key` (**partial**, `WHERE cpf IS NOT NULL`) were **MOVED as the
same statements** from `profiles`, not re-typed — a plain `unique` would coincide on NULLs by accident
and differ in shape, name and plan.

⚠ **ROW EXISTENCE IS A FACT, NOT AN IMPLEMENTATION DETAIL.** Only people with at least one of the three
have a row. That is the "has restricted details on file" predicate, and it is what an LGPD/DSR deletion
discharge must remove — nulling the columns leaves the assertion standing. Pointer:
[`plans/dsr-workflow-plan.md`](../plans/dsr-workflow-plan.md) § 3.

**Reach — the AE1.6 door-only class** (RLS on, **0 policies**, `authenticated` **and** `anon` hold
nothing; `service_role` holds all four verbs). It is the **first non-PHI member** of the zero-policy
class, whose membership is pinned by `382` § A0 — now **8** tables, derived, not hand-listed.

| consumer | direction | note |
| --- | --- | --- |
| `public.get_own_person_record()` | read (self) | LEFT join — a person with no row must render empty fields, **not** "not found" |
| `public.list_org_people(...)` | read | payload DOB via LEFT join; the exact-CPF probe via **INNER** join; `person.cpf_lookup` audit **unchanged** |
| `app.update_person_fields_impl` | write | UPSERT; `p_set_*` false keeps the stored value, never nulls it |
| `app.finalize_invited_person_impl` | write | UPSERT; a person invited pre-AE3 has no row, so UPDATE alone would write nothing |
| `getPersonAdminView` (`src/lib/users/person-footprint.ts`) | read (service-role) | ⛔ existence now checked on `profiles` **separately** — see below |
| `updateUserProfile` / `registerUser` (`src/lib/users/actions.ts`) | read (service-role) | the `cpf_change` change-detector, and the registration collision probe (`.eq('cpf', …)`) |

⛔ **THE SPLIT CREATED A DENY-BY-ACCIDENT SHAPE, CAUGHT AND FIXED — do not re-merge these reads.**
Before AE3 one query answered *"does this person exist"* **and** *"what are their values"*, because
both lived on `profiles`. After the split a null private-details row means only "nothing on file", a
legitimate state — so `getPersonAdminView` reads `profiles` for existence and
`profile_private_details` for values. Merged back, every person who never had a CPF/DOB/phone recorded
gets `personalData: null` plus both authority booleans false, which is **indistinguishable to the
caller from "you may not administer this person"**.

⚠ **`guard_profile_privileged_columns` lost three arms and kept the rest.** `cpf`/`date_of_birth`/
`phone` left `v_identity_changed` in `006700`, one migration **before** the columns dropped in `006800`
(plpgsql is late-bound). The refusal moved from **23514** (trigger) to **42501** (absent grant) — one
layer earlier, and visible to the standing arms in a way a trigger arm never was. `359` § 3 asserts
retire **and** replace; `386` § 3.4 pins the new SQLSTATE.

⛔ **CPF IS NOT CONSOLIDATED.** `professional_profiles.cpf` (Class-2, ADR 0064/0065) was **not** moved
and keeps its own column-list withholding. Two relations carry a CPF under different regimes.

**Out-of-arm coverage note.** The door-sweep deriver returned **zero** cases for this migration set and
exited **1** — a finding, ruled per-function (four of the five changed functions are not gates; they
call `app.can_administer_person_for`, which is unchanged). The fifth,
`guard_profile_privileged_columns`, returns `trigger` and no arm can neutralize it, so it owes a
targeted case: `supabase/tests/mutation/ae3-targeted-cases.sh`, **both cases COVERED**, rollback
fingerprint-proven.

## AE4 — the `authz` catalog exists, and THREE of 43 permissions are load-bearing (2026-09-03; ADR **0155** / **0162** §2 / **0172** / **0174** / **0175** / **0176** / **0177** / **0178** / **0180** / **0181** / **0182**; migrations `20261003007100`–`…007340`, **22**; pgTAP `401`–`414`, **14**; **NO flag — the migrations ARE the cutover**)

⛔ **THE COUNTS ABOVE WERE RE-DERIVED BY COUNTING FILES 2026-09-03, and both were wrong in the same
direction.** This header read *"`…007100`–`…007300`, **17**; pgTAP `401`–`411`, **11**"*. The cited
migration range actually holds **18** files, so the count was **one low before three more landed** —
`…007310` (ADR 0180, the `scope_reaches` ascent), `…007320` (ADR 0182, statement-scoped resolution)
and `…007330` (its `search_path` correction) — and pgTAP had gained `412` and `413`. ⚠ Two errors
compounding: a stale range hid a miscount, and the miscount made the stale range look plausible.
*Count the files; never increment a recorded number.*

⛔ **THE CATALOG IS AUTHORITY-ELECT, NOT AUTHORITY** (ADR 0162 §2). Until assignment storage is
bound to it, `authz.roles` is an **additional** role authority beside `memberships_role_check`, the
scope-shape CHECK, `public.platform_role` and the TypeScript manifest — not a replacement. ⛔ The
phrase *"the catalog is the authority"* may not appear in a gate record before AE5-complete, and
*"catalog cutover"* may not describe AE4.6. The honest sentence is the one below.

**The honest one-line state:** `staff_admin` runs on layer 1; **3 of 43 permissions are re-keyed,
40 are `pending-rekey`**; and **5 non-permission grant paths survive inside** the three re-keyed
authorizers.

### The three interfaces (ADR 0176 D2) — only layer 3 may be called for a permission decision

| Layer | Objects | Who may call it |
| --- | --- | --- |
| 3 — domain authorizer | `app.can_edit_commission_forms` (new, D6) · `app.can_create_professional` · `app.can_read_professional_profile` — each carries its permission code as a **string literal** (D7: statically greppable) · **`app.current_professional_read_organizations`** (ADR 0182; SET-valued, no principal argument — binds `auth.uid()` internally) | RLS policies, command doors, server actions |
| 2 — resolver | `authz.has_permission` (runtime; `authoritative` only, fails closed) · `authz.candidate_has_permission` (pre-cutover oracle; also sees `test_validation`, **never** EXECUTE-granted) · `authz.explain_permission` · `authz.entailed_grants` · **`authz.authorized_scope_ids`** + **`authz.candidate_authorized_scope_ids`** (ADR 0182 — the SET-valued twins: they PROPOSE a candidate scope per assignment fact and let `has_permission` / `candidate_has_permission` CONFIRM each, so over-granting is impossible by construction and a wrong candidate map can only DENY) | layer 3, and tests |
| 1 — assignment projection | `authz.holds_role` · `authz.assignment_facts` · `authz.scope_reaches` | layer 2, and the transitional role wrappers |

⛔ A policy or door calling layer 1 or 2 **directly for a permission decision** is a finding; the
enforcement manifest is how it is found.

⛔ **Who ELSE calls a layer-3 authorizer is declared in the manifest, not here** (ADR 0193 D5/D7,
ADR 0186 one-home). A consumer of an authorizer is exactly one of three declared things —
an `enforcementSites` entry, a `definerSurface` entry (a SECURITY DEFINER writer behind a declared
site's relation, with the gate it actually carries), or a `nonEnforcementConsumers` entry (the
Rule 11 audit registry `app._audit_access_authorized`, which decides what the trail RECORDS and
never what a caller may read). pgTAP `410` § 8.7 / § 8.8 close both axes against the live catalog
in both directions. Home: `supabase/tests/vectors/authz-enforcement-manifest.json`.

### Measured on a fresh reset, with the query so it is re-run rather than quoted

⛔ `DB=supabase_db_azkbbhskturikxpgmafq`; **no `psql` on PATH** — `docker exec "$DB" psql -U postgres -d postgres -At -c "…"`.

| fact | measured | query |
| --- | --- | --- |
| roles by state | **1 `authoritative` (`staff_admin`) / 11 `legacy`** | `select state, count(*) from authz.roles group by state` |
| permissions | **43** | `select count(*) from authz.permissions` |
| `authz` functions, all `prosecdef` | **10** (was 8; ADR 0182 added the two SET-valued twins) — ⚠ pgTAP `401` **18.4** is the cardinality control that reds when this moves, and `20.3` the domain control; ⛔ neither may be bumped without grant-checking what was added | `select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='authz'` |
| **no client role reaches `authz`** — anon, authenticated **and service_role** | **all false**, and `authz` is absent from `config.toml`'s exposed schemas | `select r, has_schema_privilege(r,'authz','USAGE') from unnest(array['anon','authenticated','service_role']) r` |
| permission-code **literals** in `app`+`public` (the seam's existence, falsifiable) | **3** — one per re-keyed site; was **0** before `…007300` | `pg_proc` × `authz.permissions`, comment-stripped `prosrc` containing the code |
| manifest countdown | **43 rows, `{"pending-rekey":40,"re-keyed":3}`** | `npm run lint:authz-vectors` |
| `is_staff_admin_of` in policies | **59** (was 63 — D6 re-pointed 4) | `pg_policies`, `qual`/`with_check` ~ `is_staff_admin_of\(` |
| `is_tenancy_admin_of` in policies | **51** (was 55 — same 4, arm moved INSIDE the authorizer) | same, `is_tenancy_admin_of` |
| pgTAP | **`Files=259, Tests=8685`, exit 0** | `npm run test:db` on a fresh reset |

### ⛔ Five residual legacy arms live INSIDE the three layer-3 authorizers

⚠ **Superseded** — the `app.can_read_professional_profile` row's `is_admin` arm below is now `is_admin_for`; the arm did not retire, only the principal it evaluates changed (ADR 0200). See authorization-and-audit.md § Subject-keying of the professional-identity predicates.

A re-keyed authorizer is **not** purely permission-keyed. Each retains the non-permission arms that
granted before, so legacy equivalence holds for principals whose roles are still `legacy` (and
whose `authz.role_permissions` rows are therefore **inert** — 401 §16.9b):

| authorizer | residual arm(s) reached with NO permission grant |
| --- | --- |
| `app.can_edit_commission_forms` | `is_tenancy_admin_of_for` (org_admin + hospital_admin; **no** `platform_admin` arm) |
| `app.can_create_professional` | `can_manage_professional` |
| `app.can_read_professional_profile` | `is_admin` · `can_manage_professional` · `can_read_case_committee` |

⚠ **These are invisible to anyone auditing `pg_policies`** — the arm is inside a DEFINER body, and
deleting it later is a one-line edit no policy-level assertion would see. Two controls exist and
are load-bearing: pgTAP **410 §3.7** asserts each authorizer's composition, and **§4.6 pins the
five BY NAME** (a count would let one arm be swapped for another). Adding an arm reds it; *retiring*
one also reds it, because a retirement is AE5 progress that must be recorded, not absorbed.

⚠ **The composition probe's needle must anchor as `name || '('`** — a bare substring for
`app.is_tenancy_admin_of` matches `app.is_tenancy_admin_of_for(` as a **prefix**, reporting the old
name as still present and hiding a rename.

### ⛔ What has NO verdict on this surface — state these beside any "gates green" claim

- ✅ **RESOLVED 2026-09-02 — this bullet said the WRITE arm *cannot see* the four `FOR ALL` form
  policies and reports UNPROVEN (exit 3). It can now, and they are CLEAN.** The arm was bounded by an
  embedded 33-row snapshot keyed on `cmd in (INSERT,UPDATE,DELETE)` — a syntax, not the property, and
  `FOR ALL` is a write command. Re-bounded to every `pg_policy` row with `polcmd <> 'r'` lifted at run
  time (`d2069603`); swept `policy=4/107`, **4 COVERED, 0 BLIND, exit 0** (`974328e6`). ⚠ Two things
  still carry NO verdict here: all four rows are **`snapshot:ABSENT`** (no §7.2 drift tripwire), and the
  **guard arm selected 0 of 13** — the same shape as the blank this fixed, and not a pass. The committed
  baseline covers **37 of 107**; a `FROMFINDINGS` arm cannot see the other 70.
  - ✅ **CORRECTED 2026-09-08 — the three claims in the sentence above are OVERTURNED by unit
    WRITEPATH-BASELINE (pre-AE5 Batch 3).** Left beside the original, not rewritten: each was true
    when written and the reasoning is the part worth keeping. Measured on branch
    `authz-writepath-baseline` @ `e4a16b33` from one full detached run of
    `p0-authz-writepath-audit.sh` (3.88 h, `RESET_EVERY=20`, `resets=8`, bare **rc 1 = DIRTY**, which
    is the correct outcome when `blind_ct>0 || err_ct>0`).
    - *"the **guard arm selected 0 of 13**"* → the run swept **`guard=13/13`**. Every `GUARD_KEYS`
      entry carries a verdict, `public.set_primary_subject(uuid)` — which had **never** been
      verdicted by anything — included.
    - *"The committed baseline covers **37 of 107**"* → the **37 was itself short by two** at the
      time (it omitted the 2 rows merged from the `BUG-AE49-D6-REKEY-INCOMPLETE` subset run of
      2026-09-03; the true figure at open was **39 of 107**). It is now **107 of 107** policies and
      **13 of 13** guards — **120 of 120 cases measured**: 102 COVERED · 15 BLIND · 3 ERROR.
    - *"a `FROMFINDINGS` arm cannot see the other 70"* → **that vacuity is closed**; every policy in
      the arm's domain now carries a row, so a policy can no longer pass by being absent.
    - ⛔ **"Measured" is not "clean", and a row is not a pass.** 15 are **BLIND** (a write-capable
      policy whose `with check` half opens to `true` with no test noticing) — each a real finding to
      keystone, ⛔ **never allowlisted**. 3 are **ERROR / UNVERDICTED**, not COVERED: opening a
      `process_template_*` write policy aborts
      `supabase/tests/297_process_template_versioning.sql` (`Bad plan`), and the harness refuses to
      infer a verdict it did not earn. ⭐ Assertions **did** fire in those three and named the file —
      *absence of a verdict is not absence of coverage.*
    - ⚠ **`FROMFINDINGS=1 ARM=policy` is a separate, pre-existing RED** and is unaffected by this:
      it is **not** one of CLAUDE.md §6's four arms, its twelve are never allowlisted, and Batch 3
      added **five** new off-allowlist BLINDs it structurally cannot register (see the plan's
      Batch 4 hand-off note). That figure is **derived from the committed artifacts, not observed
      from an arm run**.
    - ⛔ **State, not merged.** All of the above is on branch `authz-writepath-baseline`; it reaches
      `main` only at the lead's ff-merge, which is ordered **before** Batch 4's. Re-measure rather
      than quote. (Corrected by `backend` on the lead's instruction — this file's Record-step
      custody is the lead's, and the omission was the lead's.)
- The four altered policies carried **stale `COVERED` verdicts** from five unrelated suites, earned
  against the **pre-ALTER** predicate. ⛔ `ARM=census` structurally cannot catch this — the gate is
  not a newcomer, it already has a verdict, and that is exactly what makes it silent.
- **`410` proves nothing about enforcement.** That a policy exists and contains a call are facts
  about SQL. The behavioural proof is `409`, on **writes** (a permissive sibling `*_select` policy
  keeps a row-count probe green with the write policy fully revoked).
- **No performance evidence exists** for the final path (IA-F9). It must be measured through
  policy → layer 3 → layer 2 → layer 1, **never on `holds_role` alone**.
- `hardDenyClasses` is **empty on 43/43** rows — 40 labelled `not-attributable-until-rekey`, 3
  `measured-depth1-at-sites-and-authorizer`. Honest bookkeeping, **not coverage**, and the measured
  label means only *no vocabulary gate is invoked DIRECTLY in a site or authorizer body*. ⛔ Those 3
  rows DO enforce `principal_inactive` at depth 2–4 (and one reaches `respondent_exclusion` at
  depth 5); `410` §6.2 cannot see it by construction. The zero is a search horizon, never an
  absence — `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` carries the depths and the transitive end state.

**Rollback:** [authz-rollback-runbook.md](../deployment/authz-rollback-runbook.md) + its out-of-chain
template. ⛔ Restore the **disjunct**, not the whole policy body, and **both halves** of a `FOR ALL`
policy.

## Audit read legs — AUD1 + the org-derivation class fix (2026-08-25; ADR **0149** + **0150**; migrations `20261003003000` + `20261003003100`, **2**; pgTAP `372` `plan(29)` · `373` `plan(22)`; **NO flag** — the migrations ARE the cutover) — ✅ **PUSHED 2026-08-25**

**RLS — one policy, two legs, two migrations.** `audit_log_select` is a single five-leg SELECT policy
(`audit_log` holds **exactly one** policy; `authenticated` = `r` only, every write goes through the
DEFINER writer — Rule 11). Live `qual`, re-read from `pg_policies` after both migrations:

```
app.is_staff_admin_of(commission_id)
OR app.is_tenancy_admin_of(commission_id)
OR ((commission_id IS NULL) AND app.is_hospital_admin_of(hospital_id))
OR ((commission_id IS NULL) AND app.is_org_admin_of(organization_id))                     -- leg 4, AUD1
OR ((organization_id IS NULL) AND (hospital_id IS NULL) AND (commission_id IS NULL)
    AND app.is_admin())                                                                   -- leg 5, ADR 0150
```

- **Leg 4 (`20261003003000`, ADR 0149)** lost `hospital_id IS NULL`. An `org_admin` now reads the
  **hospital-tier** rows of its own org — previously a *total* blind spot (measured pre-change, both sides
  scoped to org A: commission 173/173, **hospital 19/0**, org 16/16). It is a **reconciliation**: the
  DEFINER door `public.verify_audit_chain` already authorized an org_admin on its hospital arm, so the
  policy was brought into line with a decision the platform had already shipped.
- **Leg 5 (`20261003003100`, ADR 0150)** gained `hospital_id IS NULL`. The platform chain is **all three**
  scope keys NULL — that is how `app.audit_write`'s final `else` arm and `verify_audit_chain`'s enumeration
  both define it — and leg 5 checked only two, so a malformed hospital-tier row (`hospital_id` set,
  `organization_id` NULL) satisfied it and handed a `platform_admin` tenant **content**, against the noun
  rule. ⚠ This **amends ADR 0149 D4**, which had frozen leg 5 as a deliberate non-decision.

**Helper — `app.audit_write` now DERIVES the organization from the hospital** (`20261003003100`). It had
derivation for `p_commission` and none for `p_hospital`, so every hospital-tier caller had to pass the org
by hand; `app.trg_audit_standard_ownerships` did not, at all three of its call sites, and its rows landed
`organization_id IS NULL`. Now:

```sql
if v_hospital is not null and v_org is null then
  v_org := app.org_of_hospital(v_hospital);
end if;
```

- ⚠ **`coalesce` semantics — derivation added, validation NOT.** An explicitly-passed org still wins, even a
  foreign one. No caller does that today (swept: **179** `audit_write` callers, **27** mention a hospital,
  **1** passed one without an org), and there is **no CHECK** tying `audit_log.organization_id` to
  `hospital_id`'s org.
- ⛔ **NO BACKFILL, and it is barred twice** — measured, not argued. `guard_audit_immutable()` rejects any
  UPDATE on `audit_log` (append-only). Forcing past it shows why: `organization_id` feeds
  `app.audit_canonical` → the sha256 `row_hash`, and the row stops replaying its own hash. **Consequence:
  pre-existing NULL-org hospital-tier rows stay invisible to their org admin permanently** (availability
  half, forward-only) while the leg-5 change hides them from `platform_admin` **retroactively**
  (confidentiality half — a predicate touches no data). The two halves have different reach; do not
  summarise this as "the gap is closed".
- **Chain-neutral**, proven not assumed: the hospital chain is keyed on `hospital_id` + `commission_id IS
  NULL` in **both** `audit_write`'s seq lookup and `verify_audit_chain`'s enumeration — neither reads
  `organization_id` — and the precedence block tests `v_hospital is not null` **before** `v_org is not
  null`. ⛔ Do not reorder those branches (test 373 §3).
- A hospital id that does not resolve still yields org NULL, and such a row is now readable by **nobody** —
  fail-closed by design (test 373 §4.3). `audit_log.hospital_id` carries **no FK**.

**TS surface.** `src/lib/queries/audit.ts` — `listAuditForOrg`, `listAuditForHospital` and the
account-history timeline had doc comments describing the gap as open; rewritten with leg 4. `verifyChain`'s
scope list describes the chain *identity*, not an RLS predicate, and is unaffected. The module gained
`import 'server-only'` (2026-08-25).

## Client-role TRUNCATE grants — swept 2026-08-18 (`20260928000900`, FUP-PCITV-1 item 3)

| scope | before | after | note |
| --- | --- | --- | --- |
| postgres-owned tables (local **and** remote) | **63** granted TRUNCATE to `authenticated` | **0** | pinned by pgTAP `191` §5, property-bounded by `relowner`, with a two-direction falsifiability control |
| `storage.*` (3) + `net.*` (2), platform-owned | granted to `anon` **and** `authenticated` | **unchanged** | ⛔ **not revocable by us** — on Cloud the REVOKE returns **no error** and changes nothing (`t`→`t`). Accepted in writing: `docs/followups/follow-ups-open.md` FUP-PCITV-1 item 3 |

⭐ TRUNCATE fires **no DELETE trigger**, so it bypasses RLS *and* every statement-level guard,
including `storage.protect_delete`. Verify a grant sweep by re-deriving the set from the catalog —
never by a clean exit code. `service_role` keeps TRUNCATE deliberately.

## QO·B — org_admin / hospital_admin CONTENT WALL (2026-08-08; ADR 0100 **D12** + PO rulings **Q1–Q9**; migrations `20260915000000`–`…000500`; **NO flag — subtractive by design**)

> **M7 addendum (2026-08-09, `20260916000000` — QA r1 BLOCKER-1).** M4 had cut a PROXY population
> (the `assert_not_case_excluded` carriers), leaving ~16 ratified-§4.4 case doors armed. **M7
> derives the cut from the ratified §4.4 list itself**: 20 functions edited (armed doors incl.
> `remove_case_participant`/`record_recusal`/`case_viewer_capabilities`/`bulk_create_cases`/
> `lift_recusal`, + masked-token strips on `get_case_detail`/`list_my_cases`/`create_case`/
> `create_case_from_template`) + the 3 `case_events` policy arms. Its postcondition asserts
> **CORRESPONDENCE to enumerated names, never a count**. `cancel_case`/`close_case` additionally
> gained a zero-row not-found guard (they resolved the commission via the RLS-exempt
> `commission_of_case` and could report success while RLS swallowed the DML). The 5 ratified
> case-plane KEEPs (`grant/revoke/list_case_access`, `set_case_visibility`,
> `set_case_confidentiality`) remain armed and are pinned against over-cut (`314` 11.35).
> Keystones: `314` §9–§11 (all 29 cut doors behavioural + twinned); mutation audit `b1` 39/39.
>
> **TS session/action seam (BUG-QOB-003, commits `4dd5cfa`/`60719df`/`1dfc3fb`):**
> `CommissionAccess.role` = MEMBERSHIP role only (the tenancy-admin→`staff_admin` coercion is
> gone); tenancy standing = `CommissionAccess.isTenancyAdmin`; the Q1–Q9 KEEP surface gates
> through `canConfigureCommission(access)` / `canConfigureCommissionById(id)`
> (`src/lib/queries/session.ts`) — membership coordinator OR tenancy admin. Every KEEP action
> guard in `src/lib/*/actions.ts` + the audit CSV export route routes through that seam; CUT
> actions verified armless and annotated do-not-route. ⚠ `setTemplateCaseType` deliberately NOT
> routed (its DB door is staff_admin-only; ADR 0088) — FUP-QOB-2. Referral doors
> (`create_referral_draft`/`dispose_referral_phi`) still carry the tenancy arm at the DB while
> the UI 404s a bare tenancy admin — BUG-QOB-004, PO ruling pending; do not "fix" either side
> without that ruling.

**⚠ READ THIS FIRST — the predicate whose name has misled every reader of this repo.**
`app.is_tenancy_admin_of(_for)` is **NOT** the commission's own admin. Catalog body:

```sql
has_role('organization', c.organization_id, 'org_admin', u)
   or has_role('hospital', c.hospital_id, 'hospital_admin', u)
```

It is the **TENANCY admin**, and it is **FALSE for `staff_admin`** (measured). The
committee's own coordinator is admitted by the separate `app.is_staff_admin_of` disjunct
that sits beside it in essentially every policy — which is why removing the
`is_tenancy_admin_of` term subtracts *exactly* org_admin + hospital_admin. A rename to
`is_tenancy_admin_of` is **PO-approved as its own wave AFTER QO·B lands** (Q6) — deferred
so it cannot confound QO·B's equivalence matrix.

⛔ **`\yis_tenancy_admin_of\y` CANNOT MATCH `is_tenancy_admin_of_for`** — the word
boundary fails before `_`. Any sweep in this repo grepping the short name is silently
blind to every `_for` call site. This produced a 10-vs-12 undercount inside QO·B itself.
**Match `is_tenancy_admin_of` without a trailing `\y`, or enumerate both explicitly.**

### What the tenancy admin LOST (all of it row-level content)

| Plane | Policies | Doors |
|---|---|---|
| Responses | `responses_admin_all` **dropped outright** (bare `FOR ALL` tenancy grant) · arm off `responses_select`, `answers_select`, `answer_selected_options/references/matrix_cells/risk_matrix_select`, `response_group_instances_select` | `dashboard_free_text` · `dashboard_export_rows` · `dashboard_completion_by_member` · `get_response_for_signoff` · `supersede_response` · `target_case_response` |
| Documents | `controlled_documents_select` · `controlled_document_versions_select` · storage `controlled_documents_obj_insert_writable` · wrappers `can_read_document_of_version`, `can_read_document_object`, `can_view_printed_document` | `create_controlled_document` · `update_controlled_document` · `publish_document` · `mark_document_obsolete` · `supersede_document` · `submit_document_for_approval` · `set_document_version_file` · `list_commission_documents` · `documents_due_for_review` · `remind_document_approver` |
| Indicators | `indicator_measurements_select` | `record_indicator_measurement` · `compute_derived_measurement` |
| Case plane | — | **18 doors**, population DERIVED from A4-Unit-2's `assert_not_case_excluded` guard (31 carry it → 23 admitted the tenancy admin → 18 cut, 5 ratified KEEP) |
| Attachments | — | `app.can_write_attachment`'s **`case` arm only** (its `meeting` arm never had one — C7/A8) |

### What it KEEPS — each a ratified decision, each pinned so a sweep cannot reverse it

- **Configuration** (Q1/Q2/Q7): form definitions (`forms`, `form_versions`, `form_sections`,
  `form_items`, options/validations, block library), the 9-policy `process_template_*`
  family, committee taxonomy (`case_tags`, `case_outcomes`, `case_narrative_types`,
  `phase_results`, meeting types/settings, member titles). Rule: *the admin shapes the
  containers, never reads what goes in them.*
- **Indicator DEFINITIONS** (Q3 SPLIT): `indicators_select`, `create/update_indicator`,
  `set_indicator_target` — the measurement is cut, the definition is not.
- **The six PHI-free AGGREGATE dashboards** (D12 ⑥): `distributions`,
  `entity_references`, `form_totals`, `matrix_cells`, `risk_scores`,
  `submissions_over_time`. ⚠ The nine `dashboard_*` doors now split **six-to-three**;
  `270` asserts the two classes BY NAME, not only by count.
- **Case access + classification** (Q8/Q9): `grant_case_access`, `revoke_case_access`,
  `list_case_access`, `set_case_visibility`, `set_case_confidentiality`.
  `grant_case_access` is safe because **self-escalation is independently blocked** —
  MEASURED: an org_admin's self-grant raises *"o responsável deve ser membro da comissão"*
  since it holds no membership row, while granting a real member succeeds.
- **`revoke_printed_document`** — keeps its tenancy arm by the OLDER, more specific ruling
  **ADR 0104 D11**: revocation is a *governance* act that reveals no content (the admin
  chain may revoke an ata print it cannot download). QO·B's own §4.3 draft listed it as
  CUT; the draft is overruled.
- **`grant_role_impl` / `revoke_role_impl`**, `is_org_level_admin_within`, and the tenancy/
  identity/vocabulary nouns — administration was never in scope.
- **`_case_caps`** still routes `is_tenancy_admin_of_for`, and that is correct: A4 left
  it conferring `manage_case_access` only (`311` §6.5 pins it).

### ⛔ THE FAILURE MODE THIS PHASE EXISTS TO WARN ABOUT

**M1–M4 cut the TABLES and left SIXTEEN DEFINER DOORS OPEN**, and every gate went green.
A DEFINER door bypasses RLS entirely, so the tenancy admin still read through a door what
the table refused — measured post-M4 as `orgadmin.a`: `dashboard_free_text` **6 rows**
(free-text answers), `dashboard_export_rows` 6, `list_commission_documents` 2. Closed by
**M5 + M6**.

**Four green gates were each blind to it, in a different way:**

| Gate | Why it could not see it |
|---|---|
| A/B equivalence matrix | measures **table** row visibility under RLS — a DEFINER door is invisible *by construction* |
| ADR 0079 door sweep | neutralizes **boolean** gates; these return `SETOF` and were never in its population |
| `ARM=floor` | asks whether a door is **called**, not whether its gate is **right** |
| pgTAP `314` | asserted the tables, not the doors |

**What found it:** re-reading the ratified CUT list and asking the catalog, item by item,
*"did I actually cut this?"* — the plainest check available, and one **no harness
performs**. Run it at the end of any subtractive phase.

### Verification estate (re-derive; do not trust this text)

`supabase/tests/314_qob_org_admin_content_wall.sql` (**49 assertions**; every negative
twinned) · `supabase/tests/mutation/b1-org-admin-wall-mutation-audit.sh` (**17 cases,
17/17 RED-PROVEN — 12 under-cut + 5 OVER-CUT**, because a "did we remove enough?" audit
cannot see an over-cut) · `e2e/qob-org-admin-content-wall.spec.ts` (6/6) · relocated
siblings: `270` (two-class contract), `225` (a second `staff_admin`, not an org_admin),
`229` (×2 — twins labelled "coordinator" that passed `sa_y`, *an org_admin*), `151`, `171`,
`312`, `313`, `270_ff1`.

## QO·FUP — follow-up close-out (2026-08-07; ADRs 0101/0102; migrations `20260912000000`–`…000100`)

Beyond the expiry-seam change (recorded in the QO·A "Role doors" paragraph below, in place):

- **`list_my_nsp_hospitals()` tightened** (`20260912000100`): `app.is_active` via a `me` CTE
  (inactive caller → both union arms collapse → existing `coalesce(…,'[]')` safe default) +
  expiry + `hospital_id is not null` on BOTH arms — it was the one PQS door lacking the
  sibling filters, masked in the console path by `organizations_select` and exposed via the
  direct caller `capa-operator-gate.ts`. Pins: `145` §I (I1–I7, red-first observed); off the
  never-called allowlist (floor 83→82). FUP-QO-8 resolved.
- **`SessionContext.nspOperatorOf`** (`session.ts` / `partitionGrants`): `pqs_member` +
  `nsp_coordinator` hospital-scoped grants, routing-only (`role` field is display-only —
  gate nothing on it). `page.tsx` routes them to `/o/<org>/nsp` (first post-commission
  office branch). Instances 4+5 of the unrouted-role class.
- **The unrouted-role class guard** (ADR 0101, `session-grants.test.ts`): enumerates
  `memberships_role_check` from `pg_constraint` AT TEST TIME, drives the real `page.tsx`
  default export per role; `KNOWN_UNROUTED` ledger asserted both directions, currently
  **empty**. A new role with no landing route reds the suite.
- **`100_dashboard` t19** is now "no FIRST-PARTY public function is anon-executable"
  (excludes extension-owned via `pg_depend`→`pg_extension`; 19c plants a violation to prove
  the detector's eyes). No longer run-order-sensitive to pgtap-in-public. FUP-QO-5 resolved.
- **`a2-mutation-audit.sh`** back to an honest 12/12 (K8/Kv retargeted onto `241`'s
  deliberation-gated lane). FUP-QO-3 resolved.

## QO·A — Quality-office oversight (2026-08-06; ADR 0100 D1–D11; migrations `20260911000000`–`…000600`; **NO flag by design** — D8 default `'excluded'` + the role grant are the deny-by-default gates)

**Role.** `quality_reviewer` — tenth `memberships_role_check` member, hospital-scoped
(org+hosp NOT NULL, commission NULL; the `nsp_coordinator` shape). One row per reviewed
hospital (`memberships_grant_uq` NULLS NOT DISTINCT). Helpers
`app.is_quality_reviewer_of(uuid)` / `_of_for(uuid,uuid)` (is_active + `has_role`, which
filters expiry) and `app.is_quality_reviewer_in_org(uuid)` (direct `organization_id`
read; do **NOT** widen `is_org_level_admin_within` instead — its two-role list feeds
admin surfaces, pinned by the M6 postcondition).

**Classification.** `commissions.quality_oversight text NOT NULL DEFAULT 'excluded'
CHECK (visible|excluded)`. ONLY writer: `public.set_commission_oversight(uuid,text)`
(DEFINER; authority `is_hospital_admin_of OR is_org_admin_of` → 42501 — the committee
cannot opt itself out, platform_admin stays out (noun rule); validation `HC0L0`;
unknown `P0002`; audited `commission.oversight_changed` with previous value).
`app.guard_commission_oversight` (BEFORE **INSERT OR** UPDATE OF the column,
`IS DISTINCT FROM` on the update arm, GUC `app.in_commission_rpc` txn-local bracket)
traps raw writes for EVERYONE incl. superuser — the seed brackets its fixture.
**INSERT arm (lead ruling 2026-08-06, stricter than the `guard_case_visibility`
sibling):** outside the bracket a commission may only be BORN `'excluded'` (the
column default — creation flows untouched); zero SQL functions insert into
`commissions`, so raw PostgREST creation was a live D9 breach (initial `'visible'`
with no door/audit, `is_admin()` admitted via `commissions_admin_write`'s WITH
CHECK). Pinned both directions by `307` 1.3–1.5; RED-proven by q1 `insert_arm_noop`.

**Role doors.** `grant_role_impl`/`revoke_role_impl` gained the quality arm —
authority = the technical_director shape (`is_org_admin_of_for OR
is_hospital_admin_of_for`, **no `is_admin_for`**, and **no flag assert** — see the M3
header comment before "fixing" either). **`p_expires_at timestamptz DEFAULT NULL`**
now rides `grant_role` → `grant_role_for` → `grant_role_impl` (D9 setter; validated
`> now()`; INSERT-path only). ⚠ The re-signature was DROP+CREATE — ACLs re-established
byte-identical (`grant_role` authenticated+service_role · `grant_role_for`
service_role only · impl owner-only; pinned by `293` §1). `292` §2 now pins
`app.grant_role_impl` as the ONLY `expires_at` writer and `grant_role` as the only
expiry-taking door. ~~Two deferred seam limits~~ **REMOVED by QO·FUP F1 (2026-08-07,
migration `20260912000000`, ADR 0102 — PO ruling D-FUP-1):** an identical re-grant with a
new `p_expires_at` now UPDATES the expiry (targeted `on conflict … do update set
expires_at = coalesce(excluded.expires_at, memberships.expires_at)`), and the
commission-tier atomic-replace UPDATE writes it (same coalesce). **NULL = leave
unchanged** (never clears; "make permanent" stays revoke+regrant). Absolute set, not a
ratchet (shorten works — `306` 4.6b).
**Caller set, bounded by the PROPERTY "reaches `app.grant_role_impl`"** (QA R2 re-sweep —
the original record said "three production callers", which was a `rpc('grant_role'` GREP
bounded by SYNTAX and missed the `_for` twin entirely): **3 public doors** call the kernel
(`grant_role`, `grant_role_for`, `appoint_technical_director`); **5 further SQL functions**
reach it through them (`add_pqs_member`, `assign_org_admin`, `assign_hospital_admin`,
`assign_nsp_org_admin`, `assign_nsp_coordinator`); **9 TS RPC sites** —
`admin/actions.ts:285`, `members/actions.ts:235`, `org/actions.ts:581` + `:618`,
`platform/actions.ts:210` + `:247`, `pqs/actions.ts:65`, `users/actions.ts:714` + `:949`.
**NONE of the 9 passes `p_expires_at`** — the NULL ruling survives on a population three
times larger than the one it was decided on.
`292` §2.2 is now a **named-set** assertion (`app._t292_expiry_writer, app.grant_role_impl`).
`trg_audit_memberships`'s role-change arm carries `expires_at_before/_after` when the
expiry also moved (Rule 11 — a role-replace that writes expiry is no longer unaudited;
keystone 4.13c). Pins: `306` §4 (45 tests) + `f1-expiry-seam-audit.sh` 6/6 RED-PROVEN.
⚠ **CORRECTED 2026-08-07 (QA R1) — the previous sentence here was BACKWARDS.** It said the
sibling PHI door `app._grant_case_access_unchecked` "deliberately KEEPS the do-nothing seam".
It does not. Its `do update` list ENDS with `expires_at = excluded.expires_at` —
**uncoalesced**. That door already extends on re-grant **and NULL-CLEARS**, which is the exact
shape ADR 0102 §2 refused for the role door, on a door carrying `read_standard_phi` /
`read_restricted_phi`.
✅ **RULED INTENDED 2026-08-07 (PO; ADR [0103](../decisions/0103-case-access-null-expiry-is-permanent.md)) —
FUP-QO-7 resolved.** The uncoalesced `expires_at = excluded.expires_at` **stays**; the door is
unchanged. The two doors are ruled **oppositely on purpose**, and the deciding fact is the **caller
population**: the role door has **no** caller that passes an expiry (12 TS sites, all omit it), so a
NULL there is an accident nobody asked for ⇒ leave unchanged; this door has **exactly one** —
`grantCaseAccess` (`case-access/actions.ts:177`) ⇒ make permanent. ⚠ **The UI cannot send NULL by
accident:** the grant dialog's expiry control is a **NativeSelect** (`Sem prazo` / `30 dias` /
`90 dias` / `Data específica`) and the only blankable control — the DatePicker under
`Data específica` — fails client-side validation when empty, so NULL arrives ONLY via the explicit
`Sem prazo` choice, which on a re-grant means "remove the existing expiry". `create_case` /
`create_case_from_template` reach the kernel only via the creator self-grant with a hardcoded `null`
on a BRAND-NEW case, so the `DO UPDATE` arm is unreachable from them. Pinned: `183` §E (E0–E3, plan
19→23); falsifiable — the `coalesce` neutralisation reds **E1 and only E1**, `greatest()` reds
E0/E1/E3. ⚠ **Do not unify the two doors without re-running BOTH caller sweeps** — the asymmetry is a
property of who calls them, and it stops being true the day a caller changes. Phase C break-glass
(D14) rides a role seam that already extends.

**Resolver.** `app._case_caps` S7 (after S5, before S3): oversight-visible commission
of a reviewed hospital ⇒ `read_case_content | view_case_overview` = 5 EXACTLY — no
deliberation (D4), no PHI (D5 — `can_read_case_patient` stays false), no write (D7);
locked (`explicit_grants_only`) cases invisible to the arm (D6; exceptions ride
`case_access_grants` S3). Inherits STEP-2 `is_active` + STEP-4 hard denies by
position. Propagates automatically through `can_read_case` → `cases_select` +
`list_cases_board`. Both stale `view_case_overview` comments (S3 + `_cap_bit`) updated.

**Dashboards (D11).** `app.can_read_quality_dashboards(uuid)` OR-ed into EXACTLY the
six aggregate doors (`distributions, entity_references, form_totals, matrix_cells,
risk_scores, submissions_over_time`); the three row-level doors (`export_rows,
free_text, completion_by_member`) carry ZERO trace — `270` t9/t10 hold the boundary
(array-equality, comment-stripped) and q1's `arm_seventh_door` proves it can fail.
⚠ All nine doors deny by **silent empty `return;`**, not 42501 — deny keystones must
be zero-rows + permitted-caller pairs.

**Shell + board.** Three SELECT arms (ALTER POLICY, one disjunct each):
`commissions_select_member_or_admin` += reviewer∧visible · `hospitals_select` +=
reviewer-of · `organizations_select` += `is_quality_reviewer_in_org`.
`public.quality_board_summary(uuid)` (DEFINER; gate ≥1 unexpired reviewer membership
in the org else 42501): per visible commission — `total_cases` (readable population,
per-row `can_read_case`, incl. granted-locked), `open_cases` (readable ∧ the
`count_open_cases_for_board` predicate), `locked_cases` (eg-rows the caller CANNOT
read — **disjoint from total by construction**, `310` 2.5). PHI-free return shape
pinned column-for-column (`310` 2.6).

**TS surface.** `src/lib/queries/quality.ts` (`getQualityBoardSummary`) ·
`src/lib/quality/actions.ts` (`setCommissionOversight`) · `session.ts`:
`SessionContext.qualityReviewerOf`, `getQualidadeAccessByOrg(orgSlug)` (no-DB-read,
TD-style), `CommissionAccess.isQualityViewer` (**a FLAG, never a member role** —
`CommissionRole` stays `'staff' | 'staff_admin'`, D10). Role-label chain: fixture
`src/lib/members/__fixtures__/membership-roles.json` == `304` §10 embed ==
`ROLE_LABELS` (frontend adds the pt-BR label).

**Bytes layer (M8 `20260911000700` — lead ruling, post-probe).** S7 had propagated
to standard-tier case attachment BYTES (`attachments_obj_select_readable` →
`can_read_attachment('case'|'interview')` → `can_read_case`) — live-probed, un-audited,
PHI-capable, named by no threading list. The cut: case/interview bytes ADDITIONALLY
require `read_case_deliberation` — the load-bearing lattice invariant is that every
content-conferring source EXCEPT S7 also confers deliberation (S1/S3-closure/S4/S6;
D4 makes S7 the sole exception), so LOST=0 for every pre-existing reader, the
reviewer keeps METADATA (the panel renders names; `attachments_select` untouched)
and reaches ZERO object rows, and an S3-granted reviewer still reads bytes (the D6
graduation path is capability-shaped). `attachments-phi` has **zero SELECT
policies** (probed; M8 postcondition pins it). Reopening reviewer documents is
Phase B+ WITH an audit emit — never by deleting the conjunct. Pinned: `308` §5
(all four directions; 5.2 was observed RED pre-M8) + q1 `open_bytes_cut`.

**Read-only perimeter (M10 `20260911000900`).** S7's `read_case_content` had enrolled the
reviewer into every existing CONSUMER of that bit. Closed in two shapes: the three
authenticated write doors (`declare_conflict`, `file_correction_request`, `record_recusal`)
get an EXPLICIT `app.is_oversight_only_reader` exclusion (a read predicate is not
automatically correct on a write path); the read families get `app.can_read_case_committee`
(= `can_read_case` as it meant BEFORE S7) — Class-2 `professional_profiles` /
`professional_participants` (Rule 12/D5), `can_read_interview` (7 tables),
`can_read_action_item`, and **10** SELECT policies (votes + decisions + 7 `ethics_*` +
`action_items`, whose `case_restricted` arm routes `can_read_case` DIRECTLY — cutting the
predicate does NOT reach it). ⚠ `cases_select` is deliberately NOT re-pointed
(postcondition-pinned: re-pointing it revokes the feature). Both new predicates rest on the
lattice invariant that every content source EXCEPT S7 confers `read_case_deliberation`, so
LOST = 0 for every pre-existing reader/writer. ⚠ `file_correction_request` raises 42501 at
TWO sites (authority; corrector designation) — assert the MESSAGE, not the code.

**Verification.** pgTAP `306`–`311` (154 assertions) + `270` rewrite (13) + `292`/`293`
recuts; seed personas quality.a/.a2/.b + CCIH→visible (0-row-guarded bracket);
`q1-quality-mutation-audit.sh` **17/17 RED-PROVEN** (restore md5-verified incl. both
mutated policy quals, 5 controls green); w3/w4 harnesses re-signatured; w4
`widen_dt_scope_shape` re-add carries the new arm.

## RLS authorization surface (who can do what)

- **Builder mutation surface** — `forms`, `form_versions`, `form_sections`,
  `form_items` grant ALL to `staff_admin` of the commission + admin. Published
  immutability is **trigger-enforced**, not RLS. Draft edits need no new RLS.
- **Responses/answers** — creator alone reads/edits their `in_progress` response +
  answers. One draft per (version, user) via `responses_one_draft_per_user_idx`.
  Submitted responses/answers/signoffs are immutable (triggers). **Staff_admins
  deliberately CANNOT read another member's in_progress answers** via general RLS —
  the Phase-7 invariant; the sign-off queue/review uses the DEFINER RPCs above instead.
- **Sign-offs** — `signoffs_insert` enforces the signer-role rule in the DB
  (respondent → `created_by`; staff_admin → `is_staff_admin_of`, `signed_by =
  auth.uid()`, in_progress only). `signoffs_select` lets creator/admin/staff_admin read.
- **Storage** (`form-assets`) — members read, staff_admin upload; no UPDATE/DELETE
  (immutable paths). Service role never used on the display/upload path.
- **Cases-Extras + outcome child entities** — `case_documents`, `case_events`, `case_tags`,
  `case_tag_assignments`, `case_action_items`, and (ADR 0024) `case_outcomes` (direct
  `commission_id`), `process_template_outcomes` (via `app.commission_of_template_version`
  since ADR 0096 — it was `commission_of_template`),
  `case_offered_outcomes` (via `app.commission_of_case`) all grant member-READ / staff_admin-WRITE.
  (`case_status_defs` was DROPPED — ADR 0024.) An action-item ASSIGNEE who is a plain staff member
  does NOT get a broad UPDATE — they move status only via the narrow `advance/complete_action_item`
  DEFINER RPC (assignee-or-staff_admin gate). Document "delete" is a SOFT delete (row hidden, object
  retained); reads filter `deleted_at is null`.
- **Storage** (`case-documents`) — members read, staff_admin INSERT; NO UPDATE/DELETE
  (immutable, Rule 6). Path `{commission_id}/{case_id}/{uuid}.{ext}`; `foldername[1]` = commission.
  Reads via signed URLs (cookie client). 25 MiB, MIME allow-list (PDF/images/Word/Excel/CSV/plain).
- **Submitted cross-member read (Phase 8)** — `responses_select`/`answers_select` ALREADY grant a
  staff_admin read of ANOTHER member's `status='submitted'` response+answers (the dashboard/
  submissions browser path); `in_progress` stays creator-only. **No Phase-8 RLS change** — the
  Phase-7 in_progress-answers invariant is preserved at every dashboard/list/detail/export path.
- **Anon grants (Phase 8 B6)** — `anon` now has **zero** DML/EXECUTE on `public` (revoked from anon
  AND the implicit PUBLIC role; durable default-privilege revoke). `authenticated`/`service_role`
  retain explicit grants. pgTAP guards "zero anon-executable public functions".
- **Meetings (Phase 10)** — `meetings`, `commission_meeting_types`, `commission_meeting_settings`,
  `meeting_agenda_items`, `meeting_attendees`, `meeting_cases`, `meeting_action_items` grant
  member-READ / staff_admin-WRITE (child tables resolve commission via `app.commission_of_meeting`;
  action items via denormalized `commission_id`). `meeting_signatures` — members read; INSERT is
  **sign-own-row** (`signer_id = auth.uid() AND app.can_sign_meeting(...)`); no broad UPDATE/DELETE
  (revoke flows through `reopen_meeting`/`sign_meeting`). Meeting content (minutes/agenda/attendees/
  case-links) **freezes at `em_assinatura`** (the child-lock trigger, keyed on parent status).
  Storage — ⚠ the legacy `meeting-attachments` bucket was **RETIRED** `20260921000300`
  (FUP-F2-BUCKETS): no product writer remained after F2's `bucketForTier` rewiring, zero objects,
  and its two policies (member SELECT on bare `is_member_of(seg[1])` + staff_admin INSERT) were the
  coarse rule F2 replaced. Absence pinned by pgTAP `325` (policies derived from `pg_policies`;
  bucket row gone); the migration REFUSES if objects exist at apply time. ⚠ DM1 (2026-08-12) then
  dropped `public.attachments` + the tier buckets' policies wholesale — meeting attachments have NO
  live substrate until DM2 Wave A rebuilds them on the document model (§DM1); the `attachments` /
  `attachments-phi` bucket ROWS survive, policy-less, until DM5's retirement manifest.
  External guests are name/org free-text only (no
  account, cannot sign) — **no patient data** anywhere.
- **Interviews (Phase 11)** — the NEW write shape: `case_interviews` SELECT = member; **INSERT =
  staff_admin/admin** (bootstrap); **UPDATE/DELETE = `app.can_write_interview(id, auth.uid())`** (staff_admin/admin
  OR a registered interviewer of that interview). The 3 child tables (`case_interview_subjects`/
  `_interviewers`/`_attachments`) SELECT = member-of-`commission_of_interview`; write = `can_write_interview`
  (FOR ALL). So a registered interviewer who is a plain `staff` member can edit/conclude THEIR interview;
  a non-interviewer staff cannot (HC039). Content (subjects/interviewers) **freezes at `concluida`/`cancelada`**
  (child-lock keyed on parent status); **attachments are NOT frozen** (late signed transcript). Storage
  (`interview-attachments`) — members read (path seg [1] = commission); **INSERT keyed on seg [2] = interview_id
  via `can_write_interview`** (so a registered interviewer uploads, not just staff_admin); NO update/delete
  (immutable, Rule 6); path `{commission_id}/{interview_id}/{uuid}.{ext}`; reads via signed URLs; audio is
  LINK-only (no audio bytes). Subjects/interviewers are platform-user XOR name/org free-text — **no patient
  data** (interviewees are STAFF, never patients).
- **Patient-safety / NSP (Phase 14a — FIRST PHI; ADR 0030/0031; reverses the platform's prior "no patient data" rule under Architecture Rule 12):** `patient_safety_event` + the isolated PHI satellite `event_patient` + the append-only `event_custody` ledger all SELECT via the single **access-follows-custody** predicate `app.can_read_event(id, auth.uid())` = current custodian's commission OR the **reporting** commission (provenance, retained across hand-offs) OR PQS/admin. **No INSERT/UPDATE/DELETE policy** on any of the three — every write goes through a DEFINER RPC. A foreign committee sees nothing (route gating + RLS, not UI hiding). **PHI is minimum-necessary + isolated:** identifiers live ONLY in `event_patient`, never on the queue (`pqs_inbox`)/list/aggregate/timeline paths, and every read of it emits a Phase-13 `event_patient.read` audit row (empty metadata). `pqs_department` (non-PHI singleton config) SELECT = any authenticated member (`…121005`); writes DEFINER-only.
- **Quality indicators (Phase 15; PHI-FREE; ADR 0057/0058) — RLS posture (b):** `indicators` + `indicator_measurements` grant **member-READ SELECT only** (a commission-member read policy + SELECT grant); **NO direct INSERT/UPDATE/DELETE policy or grant** — every write flows through a DEFINER RPC whose authority is `is_staff_admin_of OR is_tenancy_admin_of`, which also guarantees `value`/`status` are always RPC-computed (a plain staff RPC-write → 42501, a direct INSERT → permission denied, and the invoker `reclassify_*` UPDATE is denied too — defense-in-depth). Reads scope per-commission (a foreign-commission member sees nothing). `hospital_indicator_rollup` returns **PHI-free counts only** (no name/code/title columns) and re-gates per hospital. The two CAPA FKs (`capa_plan.source_indicator_id`, `capa_measure.indicator_id`) are ON DELETE SET NULL.

## Extracted from the pre-split stamp chain

Recovered when the frozen currency-stamp chain left this directory
(→ [`../progress/backend-state-stamp-history-archive.md`](../progress/backend-state-stamp-history-archive.md),
ADR 0199). Each entry carries the stamp it came from and the date its subject was re-measured. All
re-measured **2026-09-09** against the local catalog at migration `20261003007350`.

- **⛔ `public.verify_audit_chain` KEEPS its `app.is_admin()` arm ON PURPOSE — do not "uniform" it away.**
  That arm is the function's **PLATFORM-tier branch**, reached only when all three scope arguments are
  null; its hospital branch already excludes `platform_admin`. The global audit chain is one of the few
  nouns `platform_admin` *is* granted (ADR 0078 A35), so this is not the BUG-AUTHZ-002 defect repeating.
  Measured — `prosrc` shows the arm inside the `else` leg: `else if not app.is_admin() then raise
  exception … using errcode = '42501'`. ⚠ This qualifier existed **nowhere but the chain**. A sweep that
  strips `is_admin` arms for noun-rule conformance would have removed it and broken platform-tier chain
  verification, with nothing in the seams to object. Stamp 2026-08-05 (BUG-AUTHZ-002).
- **The hospital-tier content-door rule, and its runtime enforcer.** A DEFINER door that is hospital-tier
  and returns **commission content** gates on `is_hospital_admin_of(p_hospital) OR
  is_org_admin_of(org_of_hospital(p_hospital))` — never `app.is_admin()`, because commission content is
  outside `platform_admin`'s nouns. `public.hospital_document_register` and
  `public.hospital_indicator_rollup` are the two doors that lost the arm (`20260908000100`). Verified —
  both are `prosecdef=t`, neither body matches `is_admin`, both match `is_hospital_admin_of` and
  `is_org_admin_of`. **pgTAP `299_hospital_content_door_noun_rule.sql` §4 enumerates the class from
  `pg_proc` at run time and reds on any member it does not recognise**, so a new hospital-tier door
  inherits the rule instead of needing to be remembered. Stamp 2026-08-05.
- **Two authz suites the seams never named:** `298_authz_p0_isolation.sql` (32 assertions, the FUP-AUTHZ-2
  keystones) and `299_hospital_content_door_noun_rule.sql` (11). Both present in `supabase/tests/`.
  Stamp 2026-08-05.
- **`270_authz_dashboard_gate_uniformity.sql`** is the standing guard on the nine `public.dashboard_*`
  doors (BUG-AUTHZ-001, `20260903000700`). It enumerates from `pg_proc` rather than fixing a list.
  ⚠ Read it before changing any dashboard gate — and note the asymmetry recorded in
  [`data-access.md`](data-access.md) § Extracted from the pre-split stamp chain: three of the nine gate on
  `is_staff_admin_of` **alone**. Stamp 2026-08-03.
- **⛔ Audit partitioning was REJECTED, and the reason is a standing design constraint.** A **time** axis
  breaks per-chain-`seq` tamper-evidence; the only correct axis is `chain_key`. Verified still unpartitioned
  — `select count(*) from pg_class where relname='audit_log' and relkind='p'` → **0**. Nothing else in the
  seams records this, so a future proposal to partition `audit_log` by month would meet no objection.
  Stamp 2026-07-05 (Wave 2, DEFERRED P7).
- **`app.guard_audit_truncate` has a GUC escape hatch, and it is fixture-only.** It raises `HC042` unless
  `current_setting('app.allow_audit_teardown', true) = 'on'`, which is set by pgTAP teardown and is
  unreachable in production. The row-level DELETE/UPDATE immutability guard is a separate, ungated
  mechanism and is untouched by it. Stamp 2026-07-05.
- **`app.is_nsp_org_admin_of` is ZERO-PHI, and that is an invariant, not an accident.** It appears in **no**
  `can_read_*`, `get_*patient*` or `*_phi*` door. Measured — that predicate over `pg_proc` returns **0 rows**,
  while the control (`prosrc ~ 'is_nsp_org_admin_of'` unfiltered) returns **11**, so the sweep is looking at a
  live population rather than an empty one. The org-tier NSP admin sees per-hospital rollups and roster, never
  patient data. Stamp 2026-07-03 (ADR 0052).

### Retired as stale — do NOT extract these

- **`trg_audit_organization_members`, `trg_audit_pqs_members`, `trg_audit_hospital_admin_grant`** — named by
  the chain as org/grant-tier audit emitters. None exists: `select tgname from pg_trigger where not
  tgisinternal and tgname = …` → **0 rows** for all three. Their tables were collapsed into `memberships`
  (S1·MEM, 2026-07-13), and membership-grant auditing now rides **`trg_audit_memberships`** on
  `public.memberships`. Retired 2026-09-09.
  ⚠ **Do not over-retire this set.** The chain names `trg_audit_hospital_updated` in the same breath and
  that one is **LIVE**, on `public.hospitals`. The `trg_audit_*` prefix is not itself a legacy tell — **47**
  live triggers use it, alongside the more common `audit_<table>_trg` form. Check `pg_trigger` per name;
  the two naming conventions coexist by history, not by meaning.

## Subject-keying of the professional-identity predicates (2026-09-09, ADR 0200, migration `20261003007360`)

`app.can_manage_professional(p_org, p_uid)` and `app.can_read_professional_profile(p_profile_id, p_uid)` are
**subject-keyed**: every arm resolves about `p_uid`. Before this migration both of
`can_manage_professional`'s arms (`app.is_admin` zero-argument, `app.is_org_admin_of(p_org)`) and
`can_read_professional_profile`'s first arm read `auth.uid()`, so a third-party-shaped signature sat over a
pure self-check; `p_uid` was a null guard and nothing else. Reach at head was **0 reachable third-party
paths** (20 call expressions in the closure, all resolving to `auth.uid()`; `app` not PostgREST-exposed; 0
triggers) — a latent trap, not a live hole, which is why no BUG row exists.

The arm named in § Five residual legacy arms above did not retire — only the principal it is evaluated
about changed: a `platform_admin` via `profiles.is_admin`, same as before. `410 § 4.6`'s five-by-name pin
and the manifest's `residualLegacyAuthority` were re-keyed with it.

**The rule this seam now carries:** `app` holds a subject-keyed `_for` twin for every caller-keyed authority
helper (`is_admin_for`, `is_org_admin_of_for`, `is_hospital_admin_of_for`, `is_staff_admin_of_for`,
`is_tenancy_admin_of_for`, `is_nsp_org_admin_of_for`). **A predicate that takes a principal parameter must
use the `_for` twin.** ⛔ The two are NOT interchangeable at SELF either: `is_admin()` trusts
`request.jwt.claims ->> 'is_admin'` (a fast path minted from `profiles.is_admin` by
`public.custom_access_token_hook`), `is_admin_for` always reads `profiles`, so swapping closes a stale-token
window for a demoted admin. That is a **tightening**, and it must be declared, never absorbed into a
no-regression claim.

**Enforced by:** `supabase/tests/415_fup_can_manage_professional_subject_keying.sql` (17 assertions;
bidirectional cells per arm per site, 6 witnessed RED before the migration) · `410 § 3.7` / `§ 4.6` (the
manifest composition) · the migration's own both-direction landing assertions, proven able to fire on a
doctored body (QA MINOR closed by measurement — `docs/progress/can-manage-professional-self-check.md`).
⛔ **Not enforced:** nothing reds if a *new* predicate pairs a caller-keyed arm with a `p_uid`-keyed one —
that obligation is ADR 0200's data statement on the AE5 template and is `prose only` today. Full record:
`docs/progress/can-manage-professional-self-check.md`; ADR `docs/decisions/0200-professional-identity-predicates-answer-about-their-subject.md`.
