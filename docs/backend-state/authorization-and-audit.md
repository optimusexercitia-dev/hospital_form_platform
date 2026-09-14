# Backend State — authorization, privilege and audit

> Part of `docs/backend-state/` — **start at [`README.md`](README.md)**, which routes you to the
> one file you need and carries the maintenance rules in full. ⛔ A posted section is FROZEN:
> correct it by APPENDING a `⚠ **Superseded** — … See <file> § <heading>.` marker, never in place.

⚠ **The corrected pt-BR authority messages (`dispose_case_phi`, `revoke_printed_document`) are recorded in [`document-model.md`](document-model.md) § END STATE.** ⛔ That frozen text says **three** and names **two**; the third is not identified anywhere, and the discrepancy is inherited, not introduced here (QA m14). Re-derive from the catalog before relying on the count. The class matters here: every arm that moved had left its message behind, and no gate reads prose.

## Current state

**Updated:** 2026-09-14 — a REPLACEABLE projection of the frozen slices below; the rules that govern it are [`README.md` § Maintenance rules](README.md#maintenance-rules) 7–8.

### Surface

- **`public.audit_log`** — the Rule 11 trail. `authenticated` = **`r` only**; every write goes through the DEFINER
  writer `app.audit_write`. `audit_log_select`'s five scope legs (incl. a platform leg needing all three keys NULL) are
  enumerated in the frozen § Audit read legs.
- **The `authz` catalog** — `roles` · `permissions` · `role_permissions`, behind three declared interfaces: layer 3
  domain authorizers (the permission code is a statically greppable **string literal**) · layer 2 resolvers · layer 1
  assignment projection. **No client role reaches `authz`** — anon, authenticated *and* service_role — and the schema
  is absent from `config.toml`'s exposed schemas. Authority helpers pair caller-keyed with **subject-keyed (`_for`)** twins; a predicate parameterised on a principal uses the `_for` twin (ADR 0200).
  **TWO roles are `authoritative`** (`staff_admin` + `staff`); **23 of 61** permissions re-keyed, **38 pending**, all 38 under `staff_admin` and all carrying the M6-fenced `not-attributable-until-rekey` hatch. A row's per-arm `subject`/`hat` now rides `enforcementSites` — ⛔ it used to live only on `armInterface`, which a row SHEDS on re-key.
- **The zero-policy, door-only table class** — RLS on, **0 policies**, `authenticated` *and* `anon` hold nothing,
  `service_role` holds all four verbs; membership is DERIVED, not hand-listed (`supabase/tests/382_…`, § A0).
- **The quality-office plane** — `quality_reviewer`, `commissions.quality_oversight` (`visible|excluded`), its **ONLY** writer `public.set_commission_oversight`, the raw-write trap `app.guard_commission_oversight`.
- **The service-role DML registry LEFT this seam** — [`service-role-dml.md`](service-role-dml.md) (ADR 0206); gate 11 reads it there, and its invariants and open edges moved with it.

### Invariants

- **A DEFINER door bypasses RLS entirely**, so cutting a table's policies does not cut its doors — recorded failure:
  tables cut, doors left open, **every gate green, each blind differently** (the four ways are enumerated in the frozen
  slices below). What found it: re-reading the ratified CUT list and asking the catalog item by item — ⛔ a check **no
  harness performs**.
- **On the door-only class the GRANT layer is what denies today, not RLS** — privilege is checked before RLS, so the
  observed 42501 is the **absent grant**; the 0-policy state is a **backstop**, operative only the day a verb is granted
  without a matching policy.
- **The privilege-budget ceiling moves only by PO ruling**, with a **named justification in the raising increment's own
  gate record**; it has **ONE home** (`BUDGET-ANCHOR`, gate 15) and ⛔ editing it to match a changed pin **inverts** the
  authority the gate enforces. **No revoke has been executed** — `UNCHANGED` is **unexamined, not cleared**, and a revoke
  removes a function from `ARM=floor`'s domain. Mechanism: frozen § Privilege budget.
- **`audit_log` is append-only, barred TWICE:** `guard_audit_immutable()` rejects any UPDATE, and `organization_id`
  feeds `app.audit_canonical` → `row_hash`, so a forced row stops replaying its own hash. ⚠ `app.audit_write`
  **DERIVES** the org from the hospital but does ⛔ **not validate** it — an explicitly-passed org wins, **even a foreign
  one**, and ⛔ no CHECK ties `audit_log.organization_id` to the hospital's org.
- **The noun rule and the content wall.** Handing a `platform_admin` tenant *content* is a breach; the tenancy admin
  *shapes containers, never reads what goes in them*. ⚠ `app.is_tenancy_admin_of(_for)` is **NOT** the commission's own
  admin — **FALSE for `staff_admin`**, admitted by the separate `app.is_staff_admin_of` disjunct; on the case-grant doors that tenancy arm **manages access and reads nothing**, kept by ADR 0205 D6 for the recused AND the absent coordinator, and the door refuses a WRITE grant on a terminal case (`HC0U0`, D9). ⛔ `\yis_tenancy_admin_of\y`
  cannot match `is_tenancy_admin_of_for`: a sweep on the short name is **silently blind** to every `_for` site.
- **The catalog is authority-ELECT, not authority** — an *additional* authority beside `memberships_role_check`, the
  scope-shape CHECK and the TS `ROLE_MANIFEST` (the enum `public.platform_role` is GONE — the catalog is the only DB-side role vocabulary now, and `app.active_role_selections.role` is text under an FK to `authz.roles(code)`), ⛔ **not a replacement**; a policy or door calling layer
  1 or 2 **directly for a permission decision** is a finding. A re-keyed authorizer is ⛔ **not** purely
  permission-keyed — residual arms sit in the DEFINER body, invisible in `pg_policies`, so they are pinned **BY NAME**:
  adding an arm reds the pin, **retiring** one reds it too. Frozen § AE4 carries the enumeration. ⚠ On the professional-profile READ door the case-committee arm (no org term; role-free at its S3/S4 case-grant sources only; `pending` reachable) is **ORACLED** by `403` with a PO-ruled value per derived class — ⛔ the admin arm there is **exercised, not oracled** (frozen § Arm 3 oracled). ⭐ The arm's role-freeness no longer means the door survives an absent or wrong hat: since ADR 0209 the **ACT hat is a DOOR-level term evaluated BEFORE every arm**, so a caller who HOLDS a live role and asks about THEMSELVES under a hat that is none of them is denied whatever arm would have answered — while a caller holding NO role keeps the reach, and no org term was added (frozen § The ACT hat becomes a door-level term).
- **A predicate's arms must answer about the principal its own signature names.** `can_manage_professional` and `can_read_professional_profile` are subject-keyed on `p_uid` since ADR 0200; `is_admin()`/`is_admin_for()` are **not** interchangeable at SELF (a JWT-claim fast path vs a `profiles` read); the model is **ratified as subject-keyed asymmetry** (ADR 0201) — third-party ignores the ACT hat, self requires it — and on the **SCOPE** axis the hat stays role-wide, so R10 (next bullet), not R8, discharges ADR 0176 D8's audit-scope obligation.
- ⛔⛔ **A HARD DENY MUST SIT ON EVERY DISJUNCT OF A DOOR'S GRANT EXPRESSION, not merely somewhere in its call closure.** Measured at AE5 T7 (L24): row 9's door OR-ed a bare permission check beside the capability arm carrying the
  denies, and one true disjunct grants — a plain member reached an `explicit_grants_only` case and an **excluded respondent reached his own**, while `410 § 6.2` measured that row's `respondent_exclusion` as SATISFIED throughout, because the
  closure genuinely reaches `is_case_respondent` down the *other* disjunct. A closure over a call graph cannot tell `A or B` from `A and B`, and ⛔ **no gate enforces this invariant today**.
- **New or touched `SECURITY DEFINER` ⇒ `set search_path = ''` + schema-qualified body** (ADR 0208 D4); the non-empty paths left (**836** after AE5 T7 converged 24 more, a PURE DELETION with 0 added; 860 after `assume_role`'s rewrite — `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','public','authz') and p.prosecdef and p.proconfig is not null and not exists (select 1 from unnest(p.proconfig) c where c='search_path=""')`) are frozen debt that **may not grow**. Two arms, each catching what the other cannot: forgetting to regenerate the frozen artifact reds pgTAP `419` (catalog), laundering an addition in by re-running the generator reds **gate 18** (bytes + git, pure deletions only, ⛔ never opens a database). ⛔⛔ **D4 has TWO clauses and they are gated in TWO files** — `419` + gate 18 hold the PATH, pgTAP **`421`** holds the BODY over the COMPLEMENT population (the 30 empty-path DEFINERs — `assume_role(text)` is the newest; `421 § 0c` asserts 860 + 30 = 890 still partitions), resolved **by Postgres**: `plpgsql_check_function_tb` for the 19 plpgsql members, a re-execution of `pg_get_functiondef` for the 11 `language sql` ones (`ALTER … SET search_path` never re-validates a body), `42P01`/`42883` the finding set, a `42P01` excused only when the SAME body creates that relation as a temp table. ⛔ **421's STATED BOUND is not coverage**: an `execute` body is opaque to both arms, so `§ 4` holds that population at **0** instead of checking it. The clause matters because under `''` `pg_temp` is still searched FIRST while all four client roles hold TEMP — the empty path NARROWS, the qualified body CLOSES (`FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`: closed by 421). ⭐ The four temp-table DEFINERs are **converged** (migration `20261003007420`); `420` measured them free FIRST and is now their regression guard, binding each one's `proconfig` and its copy counts into one assertion. ⛔ Their survival is a fact about THOSE BODIES — `pg_temp` is searched implicitly and first, so their unqualified references are temp tables — never a general licence. Frozen §§ The non-empty DEFINER population · The four temp-table DEFINERs are CONVERGED.

### Rollout

- Cutovers here are **flagless by pattern** — the **migrations ARE the cutover**; the content wall is **subtractive by
  design**; quality-office oversight is **deny-by-default** (the `'excluded'` default plus the role grant, not a flag).
  ⛔ Resolve any flag's VALUE from [`generated-feature-flags.md`](generated-feature-flags.md), never a sentence here.
  Rollback [`authz-rollback-runbook.md`](../deployment/authz-rollback-runbook.md): ⛔ restore the **disjunct**, not the
  whole policy body, and **both halves** of a `FOR ALL` policy.

### Open edges

- **"Measured" is not "clean", and a row is not a pass.** In the write-path sweep a **BLIND** row is a real finding to
  keystone, ⛔ **never allowlisted**; an **ERROR** row is UNVERDICTED, not COVERED. `FROMFINDINGS=1 ARM=policy` is a
  separate, pre-existing RED, not one of CLAUDE.md § 6's arms.
- ⛔ **`hardDenyClasses` is a committed claim (ADR 0193), non-empty on 23 of 61 — the 38 zeros are a search horizon, never an absence.** ⛔ **`410` proves nothing about enforcement**; the behavioural proof is `409`, on **writes**. ⛔ **No
  performance evidence** for the final path: measure policy → 3 → 2 → 1, never `holds_role`. ⛔ AND THE CLOSURE IS BLIND TO AN `or` (the invariant above): the live widening is closed, the blindness is NOT, and its closing gate must be shown able
  to red on L17's two-arm door — a green-on-first-run gate there is a FINDING, since a single-arm door satisfies "every disjunct" trivially (`FUP-AE5-STAFF-HARD-DENY-CLOSURE-IS-BLIND-TO-OR-AROUND`).
- Referral doors keep
  the tenancy arm at the DB while the UI 404s a bare tenancy admin (BUG-QOB-004, PO ruling pending — ⛔ do not "fix"
  either side without it); the case-grant door has the SAME shape — its tenancy arm is admitted by the app check yet refused by the RLS read of `cases` in front of it (`FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE`, **archived** — the PO ruled the surface: ADR 0205 § Amendment 1 D6·5·3, the arm stays SQL / service-role only pre-pilot, its metadata-only surface is built with the factory under `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5`). Platform TRUNCATE grants to `anon` **and** `authenticated` are **unchanged and not revocable
  by us**: on Cloud the REVOKE returns **no error** and changes nothing.
- Two frozen paragraphs below state **different** privilege-ceiling values and gate 15's `PROSE_RE` is blind to the
  older form; `document-model.md`'s pt-BR messages say **three** and name **two**. Both are FILED, ⛔ neither is fixed:
  `FUP-BACKEND-STATE-CURRENT-STATE-AUTHZ-FILE-CONTRADICTS-ITSELF-TWICE-UNGATED` — re-derive, never quote.
- ⛔ `prose only`: nothing reds if a NEW predicate pairs a caller-keyed arm with a `p_uid`-keyed one, nor if the three
  classification columns stay unread (`FUP-AE5-OPENING-ADR-CLASSIFICATION-COLUMNS-OWE-A-NAMED-CONSUMER`, ⛔ **not**
  closable by a test or lint reader — those pin their values, not their use).
- Batch 10 filed, not fixed, three follow-ups this seam owes a reader: `app.can_create_professional`'s own comment still claims a `platform_admin` arm the migration removed (a stale comment, not a live arm); `app.is_admin()` still carries an unreachable **PUBLIC EXECUTE** ACL entry (no PUBLIC schema USAGE reaches it); and `CASES=` empty selects EVERY case in the mutation-harness home that built the two targeted cases here, against **selects NOTHING** in the four `p0-authz-*.sh` homes and the door-sweep deriver — one token, two contradictory meanings.

- ⛔ **What AE5 T7 leaves OWED, three more, none gated.** `app.is_commission_staff_of(_for)` has **ZERO callers** until `AE5-MEMBER-PREDICATE-REEXPRESSION` lands; three bit-testing bodies stay UNCLASSIFIED (`can_read_full_case_content`,
  `can_read_full_meeting_content`, `is_oversight_only_reader` — C1 wired 4 of 7); and ADR 0134 Amdt 4 §A4.2's S8/S5 derivation is no longer STRUCTURAL — it holds only because both commission-tier roles in `public.memberships` hold
  `commission.cases.deliberation.read`, so a future role without it sets content-without-deliberation. `FUP-AE5-STAFF-{MEMBER-PREDICATE-REEXPRESSION-DEFERRED,THREE-BIT-TESTING-BODIES-UNCLASSIFIED,S8-S5-PAIRING-NOW-CONTINGENT}`.

### Where the detail lives

- The frozen slices below, in order: **§ Zero-policy tables** · **§ Privilege budget** · **§ Service-role DML
  registry** (a stub + forward marker; the slice is in [`service-role-dml.md`](service-role-dml.md)) ·
  **§ AE3** · **§ AE4** · **§ Audit read legs** · **§ Client-role TRUNCATE grants** · **§ QO·B** ·
  **§ QO·FUP** · **§ QO·A** · **§ RLS authorization surface** · **§ AE5's opening decision** · **§ Per-object grant
  plane (ADR 0205)** · **§ Admin arm follows account state (ADR 0201 D4/D5 + R10)** · **§ Arm 3 oracled (ADR 0175 D3 delivered)** ·
  **§ The two pre-AE5 successor decisions taken (ADR 0207 + 0208)** — 0207 D5 steps 1–5 built in the LAST slice; 0208 D4–D6 built in the
  ones before it · **§ The ACT hat becomes a door-level term (ADR 0209)** · **§ The non-empty DEFINER population is FROZEN**
  (⚠ superseded in part) · **§ The four temp-table DEFINERs are CONVERGED** · **§ D4's qualified-body clause is
  GATED by pgTAP 421** · **§ The undeclared-search_path class has ONE owner and ONE remedy** · **§ The role catalog holds roles (ADR 0207 D5 steps 1–5)** · **§ The two catalog-driven vitest suites pin the membership role SET** (test-only).
  **§ AE5 increment 1 — `staff` runs on layer 3** (the LAST slice; ADR 0211, lead rulings L13′/L15/L17→L24).
- ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) · [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) (authority-elect) ·
  [0176](../decisions/0176-authz-permission-layer-made-real.md) (the three interfaces) · [0100](../decisions/0100-quality-office-oversight.md) (oversight + content wall) ·
  [0149](../decisions/0149-org-admin-reads-hospital-tier-audit.md) + [0150](../decisions/0150-audit-org-derived-from-hospital.md) (audit read legs) ·
  [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the standing door audit) · [0205](../decisions/0205-per-object-grant-plane-convention.md) (per-object grants: root ledgers, no build before AE5-complete) · [0200](../decisions/0200-professional-identity-predicates-answer-about-their-subject.md) + [0201](../decisions/0201-the-keying-asymmetry-is-the-model.md) (keying) · [0203](../decisions/0203-the-seam-is-already-encoded-the-classification-columns-are-not.md) (the seam) · [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md) (D3, the arm-3 deferral, delivered) · [0209](../decisions/0209-the-act-hat-is-a-door-level-term-on-the-professional-profile-read-door.md) (the hat evaluated before the arms).
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

**CEILING: 772.** ⚠ **Moved 759 → 772 by PO ruling R-4(a), 2026-09-14**, for AE5-STAFF T7's THIRTEEN policy-called layer-3 doors — the named justification is that unit's gate record: 13 doors, 42 policy sites fanning onto them, and 7 further doors that need NO grant because they are called only from DEFINER bodies. ⛔ The budget counts DOORS, not sites. Previously: ⛔ **Superseded value, quoted so the move is visible and not silent: `CEILING:
752`** (the figure this file carried from 2026-08-27 to 2026-09-08). **Moved by PO ruling dated
2026-09-08** — the ruling, its measured basis and the legitimacy argument are the subsection
*"the ceiling MOVES to 759 by PO ruling"* at the end of this section. **MERGE RULE (unchanged):** no
increment may raise the count without a **named justification in its own gate record**, and **the
ceiling moves only by PO ruling**.

<!-- BUDGET-ANCHOR ceiling=772 app=339 public=433 total=772 -->

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

⚠ **Superseded** — moved to its own seam, VERBATIM: this file crossed gate 16's 160 KB warn line and
ADR 0206 applies ADR 0196 D4's remedy. See service-role-dml.md § Service-role DML registry (AE1.4 …)
— the whole slice lives there now, with its own `## Current state` block, and gate 11
(`npm run lint:service-role-registry`) reads the table from that file. ⛔ Nothing was deleted and
nothing was rewritten; this heading stays so a reader who navigates by it is sent on, not stranded.

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

⚠ **ALSO SUPERSEDED, AND THE MARKER ABOVE DOES NOT COVER IT (appended 2026-09-11, unit `AE5-MATRIX-ARM3-CELLS`)** — the same row below lists **THREE** residual arms and the live door has **FOUR grant terms**. Read from the live catalog at head pair `(20261003007390, 528)`: `app.is_admin_for` · `app.can_manage_professional` · **`authz.has_permission`** · `app.can_read_case_committee`. The AE4.9 re-key inlined `can_create_professional` into the two middle terms; the marker above moved only the FIRST name and left the missing FOURTH unremarked, so the row has understated the door's reach since that re-key. ⭐ The same omission was found and fixed the same day in the enforcement manifest's `openArms` — ⇒ it was a **two-home** drift and only the emitted, gated half was ever right. ⛔ Appended, never edited in place (README § Maintenance rule 1); this unit's own slice is a **Record-step** obligation and is NOT written yet.

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
  `grant_case_access` is safe because **a self-grant is refused as an ACT** — `HC0U1`, the door's own line
  since migration `20261003007380` (ADR 0205 § Amendment 1 D6·5·1; pgTAP `417`). ⚠ The earlier reading here
  (*"independently blocked — an org_admin's self-grant raises HC021 since it holds no membership row"*) was
  MEASURED true only because the ACT hat conjunct collapses a self-membership check onto the caller's hat — an
  incidental guard, asserted by nothing; the arm that WAS open pre-`HC0U1` was the **coordinator's**.
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
  ⚠ **Superseded** — the reader is now ONE shared function and the read is PINNED to the manifest-derived role set. See `authorization-and-audit.md` § The two catalog-driven vitest suites pin the membership role SET.
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

## AE5's opening decision — the keying asymmetry ratified as the model (2026-09-10, ADR 0201 + 0203, ⛔ NO migration)

⛔ **This slice changes no schema, no policy and no function.** Pre-AE5 **Batch 9** (unit
`AE5-OPENING-ADR`) was ruled *not a fix* (PO R1) and its defining claim is that
`git diff --name-only main... -- supabase/migrations supabase/seed.sql src` was **EMPTY**. What
changed is **what the corpus DECIDES about this seam**, and every consequence below is **Batch 10's
work, not this slice's**. Full record: `docs/progress/ae5-opening-adr.md`.

**What was ratified, and why it was not a free choice.** ⭐ **F6 was never an open question.**
`authz.entailed_grants` already emits a `hat_ok` column computed as
`(p_principal is distinct from (select auth.uid()) or af.role_code is not distinct from
app.active_role())`, under its own `§6A ASYMMETRY` comment, and **`authz.has_permission` enforces it**
(`and eg.hat_ok`) — as do `authz.candidate_has_permission` and `authz.explain_permission`, **three**
consumers, not one. That is **subject-keyed asymmetry**: a third-party question ignores the hat, a
self question requires it. ⛔ **ADR 0176 D8 does not list that option** (it names only the
exact-assignment hat and the role-wide hat), so the resolver held an **unratified answer**. ADR 0201
ratifies it (PO R8) rather than change a working resolver.

⭐ **F6 HAS TWO AXES, and the ruling settles only one.** On the **subject** axis the hat is
asymmetric. On the **scope** axis it is **role-wide** — `hat_ok` compares `af.role_code` alone, with
**no scope term**, and `app.active_role_selections` has **no scope column at all**. Meanwhile
`public.assume_role` stamps **one** scope triple into its `active_role.assumed` audit row, chosen
`order by m.granted_at desc nulls last, m.id limit 1`. ⇒ **effective authority spans every seating of
the role while the audit row names one**, and ⛔ **ratifying the asymmetry RATIFIED that mismatch**.
ADR 0176 D8's *"audit scope must match whichever wins"* is therefore discharged by **PO R10** — stamp
the **role only**, no place — ⛔ **not** by R8. ⚠ The `platform_admin` branch already stamps NULL by
its own carve-out, so this is a **tenant-role** phenomenon; a fix assuming every branch has a scope
is wrong.

**The seam model (ADR 0203, PO R11).** Audit F5's four-way seam is ratified as **already encoded** in
`supabase/tests/vectors/authz-enforcement-manifest.json`: `permissions`/`domainAuthorizer`/
`enforcementSites` = entitlement · `hardDenyVocabulary` (7 classes) = hard-deny · `lifecycleDerivation`
+ per-row `axes.resourceLifecycle` = lifecycle · sensitivity **twice** (`axes.sensitivity` on 43 of 43
rows, gated by `410 § 2.3` and the lint arm, **plus** the `gate: null` hard-deny class). ⇒ the residual
is that entry's **`note`**, the only one pointing at a deferral rather than a mechanism — ⛔ **not** a
missing gate. And the three classification columns (`risk_class`, `sensitivity_ceiling`,
`resource_kind`) are **KEPT, each owing a NAMED layer-3 consumer** — measured **0/0/0** runtime readers
across six catalog surfaces, credible only beside its control (`resolution_scope_kind` → **3**
functions) and the fact that `authz.permissions` is RLS-on / **zero-policy** / no `authenticated`
SELECT, so a consumer must be one of the ten `authz` DEFINER functions. ⛔ Removal was declined as an
**invariant loss plus the loss of its own discrimination control**: `401` **§ 7** uses two of them as
an **ordering** and `:408` proves they are two invariants, not one predicate counted twice.

**Enforcement of this slice: `prose only`, and that is the point.** ⛔ Nothing reds if a new predicate
pairs a caller-keyed arm with a `p_uid`-keyed one — ADR 0200's data statement on the AE5 template,
restated by 0201, is unenforced. ⛔ Nothing reds if the three classification columns stay unread:
`FUP-AE5-OPENING-ADR-CLASSIFICATION-COLUMNS-OWE-A-NAMED-CONSUMER` is the register's hold on it, and
⛔ it may **not** be closed by a **test** or **lint** reader — `401` §§ 11/13 and `410:122-124` pin the
columns' **values**, not their **use**.

**What Batch 10 owes, from this seam** (⛔ none of it is done here): `app.is_active` on **THREE** sites
— `app.is_admin()`, `app.is_admin_for()` **and** `public.assume_role` (R3 + R12), each with its own
**RED-first** cell, because the seating door tests `profiles.is_admin` only, so a deactivated admin can
seat a **fresh** hat and ⛔ the gap is **not** bounded by token lifetime · arm 1 **removed** from
`app.can_manage_professional` with `app.can_manage_case_vocabulary` given an **explicit**
`is_admin_for` arm, since a bare removal was measured to **strand vocabulary** (`42501`) and vocabulary
is an ADR 0078 A35 **MAY**-noun (R4) · R10's audit stamp, with ⛔ `315:212` **REWRITTEN, not ticked** —
under R10 it stays green while losing all discriminating power, because `315:208`, the cell that made
it discriminating, is the one that flips. Expected reds to **re-rule, never silence**: `228:630-634` ·
`409` § 3.7 (**polarity AND message** — `:680` still names `app.is_admin()` where the chain now reaches
`is_admin_for`) · `415` § 1.2 · `229:215-220`, which **splits in two**. ⛔ `401` and `410` are **NOT**
expected reds — their fields are name-based and their `residualLegacyAuthority` entries name **arm 2**.

## Per-object grant plane — the convention ratified, two case-door fixes landed (2026-09-10, ADR 0205, migration `20261003007370`)

> ⚠ **Amended the same day** — ADR 0205 § Amendment 1 (unit GRANT-PLANE-CONVENTION-A1, [hub](../features/grant-plane-convention-a1.md))
> added a **third** case-door fix, migration `20261003007380` (`HC0U1`, no self-grant); the count below is this slice's as written.
> The A1 slice is in [`cases-and-ethics.md`](cases-and-ethics.md) § Grant plane · A1.

**What this slice records.** Unit GRANT-PLANE-CONVENTION ([hub](../features/grant-plane-convention.md) ·
[record](../progress/grant-plane-convention.md) · [review](../reviews/grant-plane-convention-review.md), APPROVED).
The case seam carries the door detail ([`cases-and-ethics.md`](cases-and-ethics.md) § same date); this slice carries the
**authorization semantics** the convention fixes, because the previous Record step that skipped this seam is the one the
2026-09-10 second pass had to repair.

- **Grantor authority on every future grant door = coordinator ∨ tenancy admin** (`app.is_tenancy_admin_of(_for)`:
  `org_admin` of the org ∨ `hospital_admin` of the hospital, `is_active` first). The tenancy arm **manages access and
  reads nothing** — kept by PO ruling for the **recused/respondent sole coordinator** (ADR 0078's reason) AND the
  **absent** coordinator (⚠ nothing enforces coordinator presence; two seeded commissions have none; PO ruled it a
  practice, not a guard). Two safeguards travel with the arm: grantee must be a commission member (`HC021`), no self-grant (`HC0U1`, built
  2026-09-10 under Amendment 1 D6·5·1 — before it only the hat conjunct closed the self path, incidentally).
  ⛔ An administrativo never grants (D6·4); PHI abilities are never on the screen (D10).
- **The door, not the resolver, refuses a WRITE grant on a terminal case** — `HC0U0`, positioned after `42501` →
  `HC0F1` → `HC0U1` (self-grant, since `20261003007380`) → level → `HC021` → future-expiry and before `app._grant_case_access_unchecked(`; read grants on terminal cases
  stay allowed (ADR 0033 D6). `app._case_caps` carries **no** lifecycle term (ADR 0078 A24·3) — measured, not assumed.
  Keystone `416` (plan 23) RED-first on the pre-migration catalog; the door sweep identified the door (tier-2, exit 1)
  and its owed **targeted behavioural mutation** (predicate neutralized, `HC0U0` text kept) was COVERED by 416 § K1/K1b/K2
  alone across 8,946 tests, restore verified by catalog re-read — run by `backend`, **reproduced by `qa`**.
- **The app pre-check mirrors the door** (`src/lib/case-access/actions.ts` `authorizeCommission`): the `platform_admin`
  pass is GONE (ADR 0078 A35 — the door refused it with 42501 anyway), the tenancy arm and the `is_active` conjunct are IN,
  a rejected tenancy read maps to the pt-BR "unavailable" error, never a silent `false`. ⚠ **Open edge, not a defect of
  the unit:** the tenancy arm is still unreachable end-to-end — the action resolves the commission through an RLS read of
  `cases` whose only SELECT policy is `can_read_case`, FALSE for a tenancy admin (D4; S2 confers `manage_case_access`
  only). Filed `FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE` — **archived 2026-09-10** on the
  ruling (ADR 0205 § Amendment 1 D6·5·3: SQL / service-role only pre-pilot; the metadata-only surface is built with
  the factory, owned by `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5`); ⛔ neither shortcut (widen
  `cases_select`; a content arm on S2) is admissible — both re-open ADR 0078 D4.
- **Classification the convention fixes for this seam:** `case_access_grants` is the reference **ledger**;
  `commission_administrativo_capabilities` and `hospital_dpos` are **scope-level capability planes OUTSIDE ADR 0205**
  (their retrofit waits for the AE5 opening bundle — ADR 0176 D8, F8 / AE5.6); interviewer, RCA-member, attendee and
  assignee rows are **participation records** never mirrored into a ledger (D3); `referral_assignments` grants nothing.
  ⛔ **No new ledger before AE5-complete** (D12; `.claude/rules/grant-plane-convention.md` is the keystone placeholder) —
  and no permission code was added: the three code-less case abilities stay domain-only until then (D4).
- **Audit:** `case_access.granted|updated|revoked` keep `entity_id = case_id`; D7 makes that the convention (entity = the
  resource, grantee in metadata, one shared trigger) for every FUTURE ledger — existing planes' emission is untouched.

## Admin arm follows account state; the Class-2 write arm relocated; the audit stamp logs role only (2026-09-10, ADR 0201 D4/D5 + R10, migration `20261003007390`)

Pre-AE5 **Batch 10** (unit `ADMIN-ARM-IS-ACTIVE`, [hub](../features/admin-arm-is-active.md) · [record](../progress/admin-arm-is-active.md)) builds what ADR 0201 D4/D5 and the R10 ruling decided (§ AE5's opening decision, above) and takes no decision of its own. **Declared tightening** (migration header, quoted verbatim in the record's 2026-09-10 *"the BUILD"* entry): three gates tighten; the `is_admin()` JWT-claim fast path is untouched, so the surviving stale-token window is the admin FLAG alone — deactivation and suspension now take effect immediately via `app.is_active`, which always reads `public.profiles` rather than a claim.

**The three `is_active` sites, each keyed to the arm's own subject (ADR 0201 D3).**

| site | gains | keying | siblings |
| --- | --- | --- | --- |
| `app.is_admin()` | `app.is_active(auth.uid())` | CALLER | CALLER |
| `app.is_admin_for(uuid)` | `app.is_active(p_user_id)` | SUBJECT | SUBJECT |
| `public.assume_role(platform_role)` | `app.is_active(v_uid)`, `v_uid := auth.uid()` | CALLER | CALLER |

`public.assume_role`'s gate is **door-wide** — one check before ANY seating, for EVERY tier, placed AFTER the `session_selectable` check — a **declared widening** of PO ruling R12 (which reasoned only about the admin hat) rather than gating the `platform_admin` branch alone; the narrower variant was rejected for reproducing, inside one body, the gated-but-reads-open shape R12 was taken to remove. Measured cost: zero expected reds and no lost ability, since every tenant predicate already carries `app.is_active`. Witness: migration `20261003007390` header (commit `a0002067`; PO ruling R1, ADR 0201 D4's dated amendment); pgTAP `418 §§ 3.1/3.2/3.4/3.5/3.8` RED before, GREEN after (commit `f2a0da8b`); TARGETED case 2a (`supabase/tests/mutation/authz-command-door-targeted-cases.sh`, commit `c5a52efb`) neutralizes the gate and reds exactly those five `418` cells while `408` (the `session_selectable` sibling) stays green.

**The Class-2 write arm is removed from `app.can_manage_professional`, not deleted — it relocates to `app.can_manage_case_vocabulary`, and `app.can_manage_external_participant` is deliberately left unarmed (ADR 0201 D5, PO ruling R4).** `can_manage_professional`'s arm 1 (`app.is_admin()`) is gone, leaving its SUBJECT-keyed survivor (`app.is_org_admin_of_for`); `can_manage_case_vocabulary` gains an **explicit** `app.is_admin_for(p_uid)` arm — declared and answer-preserving, because the PO's own rolled-back run measured a bare arm-1 removal upstream **stranding vocabulary** (`42501`), and vocabulary is an ADR 0078 A35 **MAY**-noun. `can_manage_external_participant` gets no such arm: the door it gates, `ensure_professional_participant`, inserts a `public.participants` row with `sensitivity_class = 'professional_identity'` and the professional's real name, so an arm there would let a `platform_admin` create Class-2 identity content in any tenant's org registry — the surviving reason after D5's original stated reason ("seats a professional into a case") was measured false and the PO reaffirmed R4 on the surviving one rather than reversing it. ⇒ **declared consequence**: `platform_admin` loses professional CREATE (`create_professional_profile`, `ensure_professional_participant`) and external-participant MINT (`create_external_participant`) — 14 doors in the closure, 12 behaviourally affected (ADR 0201 D5 table) — while keeping professional READ (`can_read_professional_profile` carries its own, unaffected `is_admin_for` short-circuit) and vocabulary manage. Witness: migration `20261003007390` (commit `a0002067`); pgTAP `418 §§ 4.1/4.6/4.7` RED before, GREEN after (commit `f2a0da8b`); `228:630` (`throws_ok 42501`, was a `platform_admin` `lives_ok` positive twin) and `409 §3.7` (polarity and message — `create_professional_profile` no longer reaches `app.is_admin()`, the chain reaches `is_admin_for`), both re-ruled at commit `3b54bf11`.

**R10 — the `active_role.assumed` audit row logs the ROLE ONLY, for every tier (ADR 0201 D2).** `v_org`/`v_hospital`/`v_commission` are still SELECTed inside `public.assume_role` (`v_holds` derives from them) but never stamped, and are deliberately NOT renamed — matching storage (`app.active_role_selections` has no scope column) and avoiding a mid-session-grant staleness trap. `315:212` ("hospital/commission stay NULL for an org-tier hat") is REWRITTEN, not left ticked: its own discriminating power came from `315:208` (the org-tier cell that flips to a NULL assertion under R10), so left alone it would pass for the wrong reason — the "keystone that could not fail" shape arriving as a side effect of a correct change. Witness: migration `20261003007390` (commit `a0002067`); TARGETED case 2b (commit `c5a52efb`) restores the pre-R10 scope triple and reds exactly `315:218`/`315:242` while `418` stays green — the cross-check proving 2a moved the seating decision and 2b moved only the stamp. ⚠ **R6, found by the full prod E2E gate the same day:** the stamp's two READERS were not named when R10 was taken — the platform feed (`src/lib/queries/audit.ts` `listAudit`, rows with `commission_id IS NULL`) began showing tenant seatings and the org feed (`listAuditForOrg`) lost them; `phase13-audit` AC-3f, asserting the platform feed EMPTY as a no-leak check, reddened, and its own comment recorded that ACT stage 3 had stamped the tenant precisely to keep seatings out of that feed. PO ruled: seating is an IDENTITY event (A35 names identity + audit), the platform feed is its home, R10 stands; AC-3f now asserts every rendered platform-feed row is scope-less. Lesson LEARN-101: a ruling that changes what a column HOLDS must enumerate what READS it.

**The TS mirror (`src/lib/queries/session.ts`, PO ruling R3) — no RLS backstop on the service-role paths it feeds.** `deriveIsAdmin` (extracted, not inlined, so it is unit-testable without a hand-written copy of production text) carries the SAME `is_active` term as `app.is_admin()`, keyed the same way (CALLER), for `src/lib/{admin,users}/actions.ts`'s service-role writes. Two deliberate divergences documented at the function: it is not `deriveUserStatus`/`isInactive` (which folds `email_confirmed_at` in on purpose) and it **fails closed** on a missing profile where `status` fails open. Witness: `src/lib/queries/session-is-admin-mirror.test.ts`, 3 of 11 rows RED before (deactivated, suspended, missing profile), 11/11 after (commit `fa68436c`).

**Row 31 (`org.participants.external.manage`) gets its own differential representative (ADR 0201 D5's consequence, PO ruling R4).** Before D5, `can_manage_case_vocabulary` and `can_manage_external_participant` had identical comment-stripped bodies, so row 31's AE4.5/AE4.9 differential coverage rode on that identity alone; D5 arms the vocabulary gate only, the bodies diverge, and row 31 silently loses coverage — exactly the regression `401 §§19.2b/19.2c` and `403 §2.3b` exist to catch (a red the unit's own plan had ruled out, then measurement refuted). `scripts/gen-authz-differential-cells.py` gains a fifth `REPS` entry, `('org.participants.external.manage', 'can_manage_external_participant', 'organization')`; generated cells **864 → 1080** (5 reps × 216, both polarities: 30 granted / 186 denied for the new rep). `401:1319` §19.2b moves 2→3 (a representative now exists, not a body divergence — the divergence is the cause, the 3 is the repair); `401:1362` §19.2c is re-predicated onto the gate→representative map (re-coding it to 2 would be entailed by 19.2b's 3 and would prove nothing on its own); `403:217` §2.3b is re-ruled onto the rep's existence, wiring, scope and both polarities, denying by NAME if the rep is ever deleted. Proven live by a rolled-back plant: `can_manage_external_participant` broken open reds exactly `403 §4.1`, naming 186 disagreeing cells, all `org.participants.external.manage`. Witness: commit `a74f2409`; `docs/design/authz-ae43-staff-admin-permission-matrix.md:1235` is now further stale (still names `org.professionals.manage`) — reported, not fixed, lead's docs pass.

**The two doors outside the deriver's predicate domain got their owed TARGETED cases**, in the existing home `supabase/tests/mutation/authz-command-door-targeted-cases.sh` (commit `c5a52efb`): CASE 2 (`public.assume_role`, both halves above) and CASE 3 (`app.audit_write` — the migration changes `assume_role`'s CALL to it, R10 removing the three scope arguments, never the SINK itself; pinned live `md5(pg_get_functiondef(...))` = `3b069ecb1a1c51b340a127f7a7dcd105`, unmoved; deleting the call reds `315` on exactly 8 cells while `408` stays green). `public.assume_role`'s pre-existing category-(b) backlog entry (`supabase/tests/mutation/authz-unswept-backlog.txt` ~923) gained a dated paragraph: its keystones were named for the pre-`…007390` body, and a standing verdict does not transfer silently to a body it was never measured against.

**The derived expected-red set — nine assertions across five files, each re-ruled with a rewritten message, never a bare polarity flip:** `228:630-634` (`lives_ok` → `throws_ok 42501`, plus a NEW re-homed `org_admin` `lives_ok` twin) · `409 §3.7` (polarity AND message — the stale `app.is_admin()` naming corrected to `is_admin_for`, and the superseded A35 clause ADR 0201 D6 retires) · `415 §1.2` (+ its §1 header) · `229:215-220` (splits: `1a` freeze proof on `sa_y`, `1b` the authority deny) · `257` ×4 (`:132/:141/:174` re-actored onto `oa_b`, plus three authority twins — `:209`'s flag guard fires before authority, so it gets none, an R5-accepted deviation from the plan's four). `315` is handled separately, by rewrite rather than by red: two cells (`:203-208`, `:226-230`) flip to non-NULL → NULL assertions as a direct consequence of R10, and two more (`:212` above, `:246-249`) are rewritten for dead or weakened reasoning without a polarity change. Witness: `docs/progress/admin-arm-is-active.md` § 2026-09-10 *"the BUILD"* and *"the eleven re-rulings"* entries (commit `3b54bf11`); after, all six files pass.

**Not done by this unit, reported instead:** `app.can_create_professional`'s comment *"PRESERVED ARM — org authority (platform_admin via is_admin(), org_admin)"* is now stale (site 4 removed that platform reach) — a comment, not an arm, filed as a follow-up rather than a sixth body rewritten inside a five-site migration. `app.is_admin()`'s PUBLIC EXECUTE ACL entry (unreachable — no PUBLIC schema USAGE) is likewise filed, not revoked, this unit. Full record: `docs/progress/admin-arm-is-active.md`; ADR `docs/decisions/0201-the-keying-asymmetry-is-the-model.md` D4/D5.

## Arm 3 of the professional-profile read door is ORACLED, not merely exercised (2026-09-11, unit `AE5-MATRIX-ARM3-CELLS`; ADR **0175** D3 delivered · PO rulings **R1**/**R2**; ⛔ **NO migration** — vectors and pgTAP only)

⚠ **Superseded** — the pinned bug below is FIXED: the ACT hat is now a DOOR-level term evaluated before every arm, so the door no longer survives an absent or wrong hat on a self-check, `403` §7.4 is DELETED, and the label on those cells moved. The ARM's own role-freeness is unchanged. See authorization-and-audit.md § The ACT hat becomes a door-level term on the professional-profile read door.

Pre-AE5 successor unit `AE5-MATRIX-ARM3-CELLS` ([hub](../features/ae5-matrix-arm3-cells.md) · [record](../progress/ae5-matrix-arm3-cells.md)) touches no schema, policy or grant. It changes what the differential oracle `supabase/tests/403_ae45_differential_oracle.sql` ASSERTS about `app.can_read_professional_profile`'s third arm, the case-committee traversal `app.can_read_case_committee`. ⚠ The frozen § AE4 row for this door (with its 2026-09-11 marker) still reads *"arms 1 and 3 are exercised but not oracled"*; from this slice on that sentence is true of **arm 1 (`app.is_admin_for`) only**.

**What is now true, each with its home — witnesses are in the record's § Session log, ⛔ not restated here:**

- **Arm 3 derived from the live catalog**, not from ADR 0175's three-arm picture (record entry 2026-09-10 *arm 3 derived*): it carries **no org term** (D3 confirmed), is role-free at its two case-grant sources S3 (`case_access_grants`) and S4 (case assignment) — the other six `_case_caps` sources (S1 · S2 · S5 · S6 · S7 · S8) DO route through role lookups — so it survives an absent hat (⚠ QA-corrected 2026-09-11: an earlier wording here said *no role lookup* bare), and `_case_caps` STEP 2 gates on `app.is_active` — which `pending` is **not**, so a pending professional stays reachable through it. A live, unmasked arm-3 grant was reproduced on the untouched seed before any vector changed.
- **The candidate population is a PARTITION, labelled by the generator** (PO ruling R1 — generator-side, axis-driven seam): `supabase/tests/vectors/authz_differential_cells.psql` gained a `case_reach` axis and an `arm3_divergence` label; the axis is gate-scoped to the one representative whose door carries the arm by a named rule that coverage **`arm9`** binds to the enforcement manifest's `openArms` on every run (a second permission arming `app.can_read_case_committee` reds it). Byte-identity of every pre-existing cell was **proven by diff**, never argued.
- **PO ruling R2 — one expected value per derived CLASS:** cross-org and not-a-holder reach through a case grant is **approved designed reach**; a case grant standing in for the missing ACT hat is a **BUG** — `BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE`, pinned by `403` §7.4, ⛔ never approved and ⛔ not fixed by this unit. The approved values landed in a **new 14th column** `expected_legacy_granted`; `expected_granted` — what `403` §5.1 compares against `authz.candidate_has_permission`, a resolver that correctly has **no** arm 3 — is unmoved.
- **`403` oracles arm 3:** §7.3 **REPLACED** (the whole `grant_keyed` column, one approved answer per partition; the old *"cannot grant in this fixture"* sentinel is gone), §7.3b (all four reaches measured at ONE coordinate where arms 1 and 2 are false — `unreachable` and `grant_keyed` differ by exactly one `case_access_grants` row, so a deny means `_case_caps` denied rather than an empty join), §7.4 (the filed defect pinned), §7.5 (the guard R2 requires on its fix), §4.1b (pays for §4.1's carve-out with a value). ⚠ Arm 1 stays bounded by fixture in §7.2.
- **Mutation-proven on scratch copies** (the committed `403` untouched): an org check inside arm 3, or the grant row removed, reds §§4.1b/7.3b/7.4/7.5; a **role-keyed hat check** inside arm 3 — the naive fix — reds §7.4 **and §4.1b** while leaving §7.5 green. ⇒ the constraint on the fix is **wider than R2's wording**: neither an org term nor a role-keyed hat check, because S3 is role-free by design; the surviving shape evaluates the hat **before** the arms.
- **The enforcement manifest's `org.professionals.read` qualifier is retired FOR ARM 3**, its superseded text kept verbatim, and the residual-arm `population` field carries the same dated note; **ADR 0175 D3** carries a dated delivery marker. ⛔ The Gate-AE4 qualifier ADR 0175 demands is **still owed for arm 1**.

**What this seam should say from here:** the read door has three arms and four grant terms; the case-committee arm is oracled with PO values and a pinned bug; the admin arm is exercised, not oracled. ⛔ A future fix of the pinned bug is measured against `403` §7.5 **and** §4.1b together, never against §7.4 alone.

## The two pre-AE5 successor decisions taken — the role catalog and the two conventions (2026-09-11, unit `AE5-SUCCESSOR-ADRS`; ADR **0207** *amends 0176 D8* + ADR **0208**; ⛔ **NO migration** — decisions only, builds ordered to named units)

**What changed in the surface: nothing.** What changed is what this seam should SAY about three
of its subjects, each now RULED (PO, 2026-09-11) where it was OPEN:

- **The role catalog** ([ADR 0207](../decisions/0207-the-role-catalog-holds-roles-administrativo-is-a-capability-provider.md)):
  `administrativo` **leaves `authz.roles`** as a capability-provider namespace whose entitlement
  source is **each individual capability**, never one bundle, and never a fake `role_code` inside
  `authz.assignment_facts`; the provider-neutral seam sits ABOVE the role-shaped resolver
  (`role_code · role_state · hat_ok`) and `authz.has_permission`'s interface is preserved.
  `platform_role` **retires**: `app.active_role_selections.role` → catalog-validated text + FK to
  `authz.roles(code)`, `public.assume_role` one non-overloaded text signature validating
  `session_selectable` and the real assignment, the enum dropped last, `capability_plane` removed
  from the `authz.scope_kind` DOMAIN (⚠ which also types `public.memberships.scope_kind` — a
  red-first `memberships` proof precedes the `ALTER DOMAIN`). Blast radius, measured with its
  queries in 0207 D7: 11 enum labels · 1 column · 1 routine · 0 RLS policies · 7 TS files.
  Sequencing: `staff_admin` is the already-authoritative **baseline**, not increment 1; item 1 is
  `staff`. ⛔ Nothing above is in the catalog yet — the build is unit **`AE5-ROLE-CATALOG-COMPAT`**,
  before AE5 increment 1.
- **The candidate fan-out `D`** ([ADR 0208](../decisions/0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md) D1–D3):
  a **parametric structural invariant plus accepted operational risk** — `D ≤ F` over a
  provider-neutral fact set, `Dₖ ≤ min(F, |scopesₖ|)`; for today's role provider `F = M ≤ C + R_H·H +
  R_O·O + S` (coefficients are catalog facts); ⛔ **never** *"large D is unreachable"*; **no numeric
  ceiling**. A six-clause shape assertion on the P2 instrument (comparing the two resolvers'
  candidate CTEs after normalisation — they are identical modulo three comment lines, not
  byte-identical) is ordered to **`AE4-D-SHAPE-ASSERTION`**; five re-measurement triggers named.
- **DEFINER `search_path`** (0208 D4–D6): `search_path = ''` with schema-qualified references is
  the **sole forward convention** for new or touched DEFINER functions; the 867 non-empty paths
  (825 `app, public, pg_catalog` · 39 · 2 · 1 inverted — query in 0208 D5) are **frozen
  compatibility debt**, may not grow, converge on touch; **no mass re-emit**. `414` remains the
  resolvability gate and is **NOT** the security property (the four client roles hold `TEMP` on the
  database; `pg_temp` ordering). `public.tenant_orphan_profiles`'s inverted path is fixed by a
  narrow forward `ALTER FUNCTION … SET search_path = ''` in **`DEFINER-SEARCH-PATH-NARROW-FIX`**;
  the four temp-table DEFINERs get targeted tests before any catalog-wide sweep.

Register: `FUP-AE5-MATRIX-ARM3-CELLS-INCREMENT-ONE-NAMES-TWO-DIFFERENT-ROLES` and
`…-ADR-0202-BLAST-RADIUS-CITES-ANOTHER-ADRS-CENSUS` **closed**; `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED`
and `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` **re-claused** to the builds above, still open.
Record: [`docs/progress/ae5-successor-adrs.md`](../progress/ae5-successor-adrs.md).

## The ACT hat becomes a door-level term on the professional-profile read door (2026-09-11, ADR 0209, migration `20261003007400`)

Unit `ARM3-HAT-TERM-FIX` ([hub](../features/arm3-hat-term-fix.md) · [record](../progress/arm3-hat-term-fix.md)). ONE forward migration re-emits `app.can_read_professional_profile(uuid, uuid)` — signature, `prosecdef` and EXECUTE grantee set all measured unchanged before and after — and carries the follow-up on the same body (⛔ never a comment-only migration). No schema, policy, grant or `src/` change; `npm run gen:types` moved nothing.

**What is now true, each with its home — witnesses (bare exit codes, mutation readings) are in the record's § Session log, ⛔ not restated here:**

- **The hat is evaluated BEFORE the arms, never inside one.** The door's first act after the null guard: if the question is about the CALLER (`p_uid is not distinct from (select auth.uid())`) and the caller holds at least one live role, and `app.active_role()` is none of those roles, it returns false. Arms 1/2a/2b/3 are then evaluated exactly as before. ⛔ The placement is the ruling: an org check inside arm 3 reds `403` §7.5 (it revokes cross-org grant reach), and a hat check keyed on the hat ALONE reds `403` §4.1b's 36 role-less cells (S3 is role-free by design). Both were re-measured as mutants against this body, not inherited as claims.
- **"Holds a live role" is defined by what its MINTER derives from IMPLICITLY**, not hand-listed: the set `public.custom_access_token_hook` derives `active_role` from in its **second** branch (the one reached when the session carries no explicit selection row) — live `public.memberships` rows (`expires_at is null or expires_at > now()`, byte-identical to `app.has_role`'s) plus `platform_admin` when `profiles.is_admin`. ⚠ ⛔ **It is NOT "every hat the hook can issue"** (QA finding B1, measured 2026-09-11 from `pg_proc` / `pg_trigger` / `pg_constraint`): the hook's FIRST branch reads `app.active_role_selections` and that row wins; its only writer `public.assume_role` validates holding at SELECTION TIME ONLY and nothing revalidates or removes the row afterwards (no trigger on `public.memberships` but `trg_audit_memberships`; one FK `user_id → profiles`, no `session_id` FK, no expiry column). So a session holding a STALE selection — membership revoked or expired mid-session — can present a hat this set no longer contains and is **denied** — deliberately, since `app.has_role` and `app.is_admin_for` deny that principal too. ⛔ Not repaired by reading the selection table in the door, which would re-open the very defect (`FUP-ARM3-HAT-TERM-FIX-STALE-ACTIVE-ROLE-SELECTION-OUTLIVES-ITS-MEMBERSHIP`). ⛔ No `app.is_active` term was added (account state is `_case_caps` STEP 2's job on this path) and no call into layer 1/2 (the door stays a differential subject).
- **Three exemptions, each load-bearing:** a THIRD-PARTY question is byte-unchanged (one principal's hat never alters a conclusion about another — `403` §5.2's asymmetry); a caller holding NO live role is exempt, so an explicit case grant still reaches across the role model (PO ruling R2's approved reach, `403` §4.1b's 36 cells); and the MATCHING hat falls through, so cross-org collaboration under a held hat is untouched (`403` §7.5, both directions).
- **A HATLESS holder self-checking is DENIED**, and the NULL-safety is the mechanism: both halves use `is not distinct from`, so an absent `active_role` claim matches no held role. With `=` the `not exists` would evaluate to NULL and the guard would fall through — the `BUG-ACT-NULLHAT-1` shape. ⚠ The differential vector CANNOT carry this coordinate: the token hook mints a hat implicitly for a principal holding exactly one role TYPE, so `403`'s holder personas are never hatless and the generator skips it by a named rule. It is pinned directly by `403` §7.4b instead.
- **`403` records the move by DELETING §7.4, not by editing it.** The carve-out that excused ten cells by label is gone from §4.1 AND §4.1b, which now compare every cell BY VALUE; §7.3's partition string was RE-DERIVED by running its own query; §7.4b replaces §7.4 with a LIVE four-line pin of the term (the DENY it creates · the GRANT it must not break · the hatless-holder value · and, added at the QA fix pass, a THIRD-PARTY question by a role-HOLDING caller under a hat it does not hold, which must GRANT — a one-variable differential against the first line, whose grant is over-determined by `arm2b` and says so). `plan(27)` is unmoved, and the swap is stated in the header so an unmoved total is not read as a silently dropped test.
- ⭐ **The door denies 18 grant-keyed cells, not the 10 the bug named — and the extra 8 are a RE-RULING, ⛔ PO to ratify at approval** (ADR 0209 D5). They are `other_role` SELF-checks at a cross-org coordinate that sat in the PO-approved cross-org class only because the generator's `expected()` resolves scope before the hat. R2 approved CROSS-ORG reach and never spoke to the WRONG HAT; sparing them would require conditioning the hat term on org, which is the one shape R2 forbids. The generator label is `arm3:pre-empted:door-hat-term`; the flip census moved 92 → 84.
- **The defect DETECTOR survived its defect being fixed.** Generator coverage `arm10(b)` refused a filed defect laundered into an approved legacy GRANT; with the bug fixed its subject label is empty, so the arm was re-keyed onto the `arm3:divergent-defective:` FAMILY and `--self-test` now SYNTHESISES a member. ⛔ A future arm-3 defect label must use that prefix or `arm10(b)` cannot see it.
- **Three comment corrections in the same body, read back from `pg_proc`** (⛔ never from migration text): the arm-3 parenthetical's stale `403 §7.3` citation replaced by the follow-up's `Closes when` wording as dated history, with §7.4's retirement noted (`FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION`, discharged); "PRESERVED VERBATIM" replaced by a statement that arm 3's SQL is unchanged AND the hat is now enforced above it; and — ⚠ **declared as an ADDITION, outside the follow-up's scope** — "gated by the broad `can_read_case`" corrected to the narrow committee-plane variant `app.can_read_case_committee` (`can_read_case AND NOT is_oversight_only_reader`), which is what the body actually calls.

**What this seam should say from here:** the professional-profile read door is a HAT TERM followed by three arms; the hat term binds on self-checks by role-holders only; the case-committee arm is still org-free and role-free at its S3/S4 sources and still oracled by `403` with a PO value per class; the admin arm is still exercised, not oracled. ⛔ Any future change to the hat term is measured against `403` §7.4b (all four lines), §7.5 and §4.1b together — never against one of them.

## The non-empty DEFINER `search_path` population is FROZEN and two members converged (2026-09-11, unit `DEFINER-SEARCH-PATH-NARROW-FIX`; ADR **0208** D4–D6 + ADR **0209**; migration `20261003007410`)

⚠ **Superseded** — two statements below are no longer true: the frozen population is **861**, not 865, and the four temp-table DEFINERs are **CONVERGED**, not "measured free but unconverged" (migration `20261003007420`, ADR 0208 D4 on touch). ⛔ Everything else in this slice stands, the MECHANISM paragraph included — it is why the convergence was free. See authorization-and-audit.md § The four temp-table DEFINERs are CONVERGED and the frozen population is 861.

⚠ **Superseded** (2026-09-12, unit `DEFINER-UNDECLARED-CLASS-REMEDY`) — the undeclared-`search_path` class is **RULED**, so two more statements below are stale: the bullet whose disposition is *"PROPOSED in the unit's record and is **PO to rule**"* and the closing line calling the class *"pinned by `414`, not ruled"*. The PO ruled on **2026-09-11** (same clause in this file's `## Current state`): such a `prosecdef` function is a **DEFECT to converge to `search_path = ''`** with a schema-qualified body (ADR 0208 D4), never a member to add to any frozen set, and neither `414` nor `419` may be widened to admit it — no new cell. `414 § 0b` now OWNS that finding and carries the remedy in its own message. ⛔ Everything else in this slice stands, the EXCLUSION reasoning included — it is why the class must converge rather than be admitted. See authorization-and-audit.md § The undeclared-`search_path` class has ONE owner and ONE remedy.

**What is now true, each with its home — witnesses (bare exit codes, TAP counts, the four verdicts) are in the record's § Session log, ⛔ not restated here:**

- **The population is a FROZEN NAME SET that may only SHRINK, and it is GENERATED.** `supabase/tests/vectors/definer_search_path_freeze.psql` holds the `prosecdef` functions of `app`/`public`/`authz` carrying a NON-empty `search_path` — **865** after this unit (**867** before it) — written only by `node scripts/gen-definer-search-path-freeze.mjs --write`, which reads the live catalog. ⛔ Never hand-typed: the one time a `search_path` expectation was hand-typed here it was copied out of a broken catalog and PINNED the defect (`413`'s own comment).
- **The ratchet is DIRECTIONAL, and that is the design.** `live \ frozen` is a finding (pgTAP `419 § 1a`); `frozen \ live` is the LEGAL shrink a convergence produces (`419 § 1c`, asserted positively, not by the absence of a red). A symmetric equality would red on exactly the change ADR 0208 D4 asks for.
- **TWO arms, and each catches what the other cannot.** Forgetting to regenerate reds in `419`; regenerating to LAUNDER an addition into the frozen set reds in **gate 18** (`npm run lint:definer-freeze`), which resolves the artifact's git baseline and refuses any diff that is not a pure deletion. ⛔ Neither is the other's verdict, and gate 18 **never opens a database** — "matches the live catalog" is `419`'s verdict, in `npm run test:db` (the gate-17 partition, restated in its own summary line every run).
- **The domain has ONE home.** `scripts/definer-search-path-census.sql`'s `definer_nonempty_domain` block is extracted by text into the generator and spliced by text into `419`; gate 18 compares the two copies byte-for-byte, because a domain that narrowed in both places at once would be silently clean.
- ⚠ **The empty form is the two-character string `""`, not the empty string** — `set search_path to ''` stores as the proconfig element `search_path=""`. A predicate written `sp <> ''` classifies every empty-form function as non-empty and freezes all 890.
- ⚠ **`authz` contributes ZERO rows to the frozen set and is fully swept** — all ten of its DEFINERs already use the empty form (`419 § 0b` pins `0 of 10`). ⛔ Do not read the absence of `authz` names in the artifact as the absence of `authz` from the ratchet.
- **Two members converged, by `ALTER FUNCTION`, with no body re-emission**: `public.tenant_orphan_profiles()` (ADR 0208 D6 — the sole member of the inverted `public, app, pg_catalog` bucket, the only SEMANTIC singleton in the population) and `app.can_read_professional_profile(uuid, uuid)` (the FUP's *Scope added* / ADR 0209 — re-emitted by `20261003007400` and kept its non-empty path, so D4's "touched ⇒ converges" applied). ⛔ `app.tenant_orphan_profiles()` is a SEPARATE subject and is **not** touched; it stays in the 825-bucket and in the frozen set.
- **`413`'s two sibling pins now hold DIFFERENT values, deliberately.** `app.can_read_professional_profile` pins `search_path=""` and `app.current_professional_read_organizations` still pins `search_path=app, public, pg_catalog`. ⛔ A reader "repairing" them back into agreement would undo a decision, not fix a drift — and a sibling-equality differential could not even express this state, which is why `413` pins each independently.
- **The four temp-table DEFINERs are MEASURED, and all four are a FREE change** (pgTAP `420`): `app.copy_response_answers` · `app.copy_template_version_children` · `app.copy_version_children` · `public.clone_framework`. ⛔ **THE VERDICT IS NOT THE FINDING — the MECHANISM is.** Postgres searches `pg_temp` implicitly and FIRST for relation names whenever it is not listed explicitly, so `search_path = ''` does not remove the temp schema from relation resolution; it removes `app` and `public`. That is the SAME mechanism ADR 0208 D5 names as the reason to prefer the empty form (a temp object can precede the declared schemas and shadow an unqualified relation) — here it is what makes these four survive, and in a body naming a PERSISTENT relation unqualified it is the hijack. `420 § 6` proves the instrument can see that failure (a planted unqualified-persistent DEFINER reds with **42P01** under the same ALTER), so the four OK verdicts are measurements and not an instrument that cannot fail.
- ⛔ **"Free" is a finding for a FUTURE convergence, not one this unit performed.** All four remain `prosecdef` on a non-empty path and remain members of the frozen set (`420 § 5b` pins `4`); every ALTER in `420` is confined to its own savepoint and `420 § 5` proves all four are restored.
- **The `.claude/rules/` hint exists as ONE LINE inside `migrations-forward-only.md`**, already scoped to `supabase/migrations/**` — ⛔ not a dedicated file: `.claude/rules/` is at its `MAX_RULES = 12` cap and a 13th file reds gate 8. The dedicated file is DEFERRED to a PO ruling on the cap. ⛔ The line names `419` + gate 18 as the enforcer and says so: a rule is a hint, never a substitute for a gate (CLAUDE.md §8).
- ⛔ **STILL OPEN — a DEFINER with NO `search_path` at all** (`414 § 0b`'s 890/890) is outside the freeze by construction, because `sp is null` is not a non-empty path and admitting it would make the ratchet's subset arm ambiguous about which half moved. A disposition is PROPOSED in the unit's record and is **PO to rule**.

**What this seam should say from here:** the non-empty DEFINER population is a generated frozen set of **865** names, ratcheted by `419` (catalog) and gate 18 (bytes + git); the empty form is the sole forward convention; the four temp-table DEFINERs are measured-free but unconverged; and the undeclared-`search_path` class is pinned by `414`, not ruled. ⛔ Any future convergence regenerates the artifact by `--write` ONLY, moves `419`'s two pins in the same change, and produces a diff that is a PURE DELETION.

## The four temp-table DEFINERs are CONVERGED and the frozen population is 861 (2026-09-11, unit `DEFINER-TEMP-TABLE-CONVERGENCE`; ADR **0208** D4/D6; migration `20261003007420`)

⚠ **Superseded** — one clause below is a PARAPHRASE ADR 0208 D5 does not carry, corrected here rather than in place (2026-09-11, QA r1 MINOR-3). The false clause is *"0208 D5 requires [a new ADR] only to admit a SECOND compatibility form"*. D5's actual sentence (`0208:239-241`) constrains the SHAPE such a form would have to take — *"If a second compatibility form is ever admitted, it is property-based … ⛔ never the current dominant string"* — and says nothing about when an ADR is required. ⭐ The airtight ground for "no new ADR" is **D4's verbatim ruling**, which already ORDERS this convergence and therefore leaves no decision to take: *"SET search_path = '' with schema-qualified object references is the sole forward convention for new or touched SECURITY DEFINER functions. Existing nonempty paths are frozen compatibility debt, not an alternative convention; they may not grow and converge to the empty form on touch."* ⛔ Everything else in this slice stands. See authorization-and-audit.md § The four temp-table DEFINERs are CONVERGED and the frozen population is 861.

⚠ **Superseded** (2026-09-12, unit `DEFINER-UNDECLARED-CLASS-REMEDY`) — the STILL OPEN bullet below is stale in both of its live clauses. D4's schema-qualified BODY clause is **GATED** (pgTAP `421`, unit `DEFINER-QUALIFIED-BODY-GATE`, 2026-09-11), and the undeclared-`search_path` class is no longer *"PO-ruled but unbuilt"*: the ruling of **2026-09-11** is now BUILT as a named owner rather than as a new gate — `414 § 0b` carries the remedy (converge to `search_path = ''` with a schema-qualified body, ADR 0208 D4; ⛔ never widen `414`/`419`, never add to the frozen set) and `421 § 0c` counts the class and points at that owner. ⛔ The `.claude/rules/` D5 hint clause and everything else in this slice stand. See authorization-and-audit.md § The undeclared-`search_path` class has ONE owner and ONE remedy.

**What is now true, each with its home — witnesses (the before/after `proconfig` values, the red-first TAP, gate exit codes) are in the record's § Session log, ⛔ not restated here:**

- **Four members converged, by `ALTER FUNCTION`, with no body re-emission**: `app.copy_response_answers(uuid, uuid)` · `app.copy_template_version_children(uuid, uuid)` · `app.copy_version_children(uuid, uuid)` · `public.clone_framework(uuid, uuid)`. All four were `prosecdef=t` on `search_path=app, public, pg_catalog` and all four now carry `search_path=""`, MEASURED on `pg_proc` before and after — ⛔ never read off the migration text, which is stale by design (ADR 0078). Exactly one overload per name (4 of 4), which is the catalog fact four signature-keyed `alter function` statements rest on; `420 § 5d` pins it.
- **The convergence was ORDERED, not discretionary.** ADR 0208 D4 converges a NEW or TOUCHED `SECURITY DEFINER` to the empty form; D6's precondition — targeted tests before any ALTER — was discharged by pgTAP `420` in the predecessor unit, which measured all four FREE. ⛔ No new ADR: 0208 D5 requires one only to admit a SECOND compatibility form, and this admits none. The follow-up's *Closes when* was `PO to rule`; the PO ruled CONVERGE.
- **The frozen set shrank by exactly four: 865 → 861.** The lineage, so the figure is dateable rather than bare: **867** → **865** at `20261003007410` (two members) → **861** at `20261003007420` (these four). `supabase/tests/vectors/definer_search_path_freeze.psql` was regenerated by `--write` ONLY and the committed diff is a PURE four-row deletion plus its anchor line; gate 18's check F prints `baseline 865 -> 861 (removed 4, added 0)` and names the four. `419 § 0c` (rows) and `§ 0d` (md5 over the frozen names) moved in the same change — ⛔ moving one without the other is the drift those two pins exist to catch.
- **`420` is no longer a survey; it is this migration's REGRESSION GUARD**, and its two pins are the same assertions with the opposite values: `§ 5` now reads all four on `search_path=""` and `§ 5b` reads `prosecdef:4 nonempty:0` — i.e. none of the four is a member of `419`'s frozen set any more, measured with `419`'s OWN predicate rather than by reading its artifact. ⚠ `prosecdef` is asserted IN THE SAME STRING as `nonempty`, because "0 non-empty" is also what a catalog in which the four had stopped being `SECURITY DEFINER` would report — a different, worse change wearing this one's green.
- ⭐ **Each § binds the CATALOG half and the EFFECT half into ONE assertion.** A function's live `proconfig` travels inside the same named string as its copy counts (`items=6 sections=1` · `phases=1` · `answers=2 selopts=2` · `standards=2 rewired=1` — the values `420` measured BEFORE convergence, re-asserted against the converged catalog). Split apart, a silent revert to the three-schema path would still satisfy the effect assertion and a function that had stopped copying would still satisfy the catalog assertion; neither is a pass.
- ⛔ **THE ALTER ARMS WERE REMOVED, AND THE REMOVAL IS THE CONSERVATIVE MOVE.** Every § used to carry a TODAY arm plus a savepoint ALTER arm, and the `[cfg …]` witness discriminated between them only because TODAY ≠ `''`. Once the migration lands, `alter function … set search_path = ''` on a function already on `''` is a NO-OP and its arm is an assertion that CANNOT FAIL — a green arm that cannot fail reads as coverage it does not have. ⭐ The per-section savepoints STAY: they were introduced for a second reason that outlives the ALTERs (cross-probe contamination), and `§ 6` stays verbatim and is now the file's ONLY arm exercising the empty path as a CHANGE — a planted DEFINER with a bare `from profiles` must red with **42P01** under the same ALTER, or `§§ 1–4` are four green pins with nothing behind them.
- ⚠ **The mechanism is unchanged and is still the finding, not the verdict.** Postgres searches `pg_temp` implicitly and FIRST for relation names whenever it is not listed explicitly, so `search_path = ''` removes `app` and `public` and NOT the temp schema. That is why these four survive — their unqualified references ARE temp tables. ⛔ In a body naming a PERSISTENT relation unqualified the same mechanism is the hijack, so "free" is a statement about THESE FOUR BODIES and never a general one.
- ⛔ **SCOPE FENCE — what this did NOT touch.** `app.tenant_orphan_profiles()` is still unconverged (it is `419 § 1b/1c`'s shrink control and converging it would collide with that control's subject); `app.current_professional_read_organizations` is still pinned on the three-schema string by `413`, deliberately, beside its converged sibling. The remaining **861** are frozen debt that converge ON TOUCH, one ruled unit at a time — this is not the catalog-wide hardening sweep ADR 0208 D6 warns about.
- ⛔ **STILL OPEN, and untouched by this unit**: D4's schema-qualified BODY clause is UNGATED — no gate here, in `419`, or in gate 18 reads a function body (`FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`); the undeclared-`search_path` class (`414 § 0b`'s 890/890) is outside the freeze by construction and its disposition is PO-ruled but unbuilt; the `.claude/rules/` D5 hint file stays deferred at the `MAX_RULES = 12` cap.
- ⚠ **A figure about ANOTHER file goes stale when that file changes, and nothing reds.** `419`'s header carried `420` emits `planned 15 tests but ran 13` as the expected-noise example; the re-cast makes it `planned 11 tests but ran 9`, and the line was moved in the same change. That is the identical shape as QA r2 MINOR-r2-1 in the predecessor unit — a wrong expected diagnostic pre-authorises dismissing one the file never prints.

**What this seam should say from here:** the non-empty DEFINER population is a generated frozen set of **861** names, ratcheted by `419` (catalog) and gate 18 (bytes + git); the empty form is the sole forward convention and a touched DEFINER converges to it; the four temp-table DEFINERs are CONVERGED and `420` guards them by binding `proconfig` to copy counts in one assertion per function; `app.tenant_orphan_profiles()` and `app.current_professional_read_organizations` remain deliberately unconverged and each has a named reason. ⛔ Any future convergence regenerates the artifact by `--write` ONLY, moves `419`'s two pins in the same change, produces a diff that is a PURE DELETION, and re-casts whatever pinned the OLD state rather than leaving it to red.

## D4's qualified-body clause is GATED — pgTAP `421`, one arm per language (2026-09-11, unit `DEFINER-QUALIFIED-BODY-GATE`; ADR **0208** D4 second clause; NO migration)

**What is now true, each with its home — witnesses (the TAP lines, the three mutation runs, gate exit codes) are in
the record's § Session log, ⛔ not restated here:**

- **D4's SECOND clause has an enforcer, and it is a pgTAP file, not a rule hint or a review obligation.**
  `supabase/tests/421_definer_qualified_body.sql` closes
  `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED`, whose *Closes when* was `PO to rule`
  until the PO ruled **option (a), a catalog gate**, on 2026-09-11. ⛔ No new ADR: D4's verbatim ruling already states
  the two-clause convention; this is the missing enforcer, not a new decision.
- **The subject is the COMPLEMENT of `419`'s.** `419` freezes the **861** non-empty paths; `421` reads the **29**
  empty-path `prosecdef` bodies in `app`/`public`/`authz`. `421 § 0c` asserts `890 = 861 + 29` as ONE named string, so
  a member acquiring a third form (e.g. `<none>`, `414 § 0b`'s class) falls out of BOTH gates and reds here. ⛔ 421
  writes its OWN domain predicate and does **not** splice `419 § 0` — gate 18 compares that block byte-for-byte with
  `scripts/definer-search-path-census.sql`, so copying it would bind 421 to a text the generator owns.
- ⭐ **POSTGRES resolves the bodies; there is no parser.** ⛔ A regex over `from`/`join` targets would have to
  re-implement name resolution and every case it got wrong would be a SILENT pass. Two arms, keyed on `pg_language`
  and disjoint: **plpgsql (18)** via `extensions.plpgsql_check_function_tb(oid, tgrelid, fatal_errors => false)`,
  which applies the function's own `proconfig` and not the session path (measured: a plant on `''` reds even under
  `set local search_path = public, app, pg_catalog`); **sql (11)** via re-executing `pg_get_functiondef(oid)`, because
  a `language sql` body IS validated at CREATE under its declared path but **`ALTER FUNCTION … SET search_path` never
  re-validates** — the exact shape of every narrow convergence migration this program writes (`20261003007410`,
  `20261003007420`). Finding set: `42P01` + `42883`.
- **The `42P01` exclusion is bounded to ONE body.** A `42P01` is excused only when the SAME `prosrc` creates that
  relation by `create temp[orary] table` — the four ADR 0208 D6 DEFINERs, on exactly five relations
  (`_clone_item_map` · `_clone_section_map` · `_clone_standard_map` · `_copy_answer_map` · `_tpl_phase_map`, pinned by
  `§ 1b`). ⛔ It excuses nothing else, and THREE mechanisms deliver that bound, not the escape alone: the relation
  name is regex-escaped before interpolation (an identifier carrying a metacharacter cannot widen it), the
  interpolation is anchored `\m`…`\M` (a body creating `_xy` no longer excuses a finding on `_x`), and the match runs
  over EXECUTABLE text — `prosrc` scrubbed of `/* */` block comments, `--` comments and single-quoted literals, so
  prose cannot satisfy it. ⛔ DOLLAR-QUOTED text is NOT scrubbed: the one gap erring UNSAFE (prose inside `$q$…$q$`
  would excuse a real finding), bounded today by **0 of the 29** bodies carrying a dollar-quote tag and by `§ 1b`
  pinning the RAW pre-exclusion relname set, which reds the day one arrives. 421's header states it and says why no
  stripper is added (QA r2 MINOR-4; the last two mechanisms were measured over-matching at QA r1).
- ⛔ **THE STATED BOUND, WHICH IS NOT COVERAGE.** Dynamic SQL is opaque to both arms — `execute 'select … from
  profiles'` is a string until run time. `§ 4` therefore holds the `execute`-carrying population at **0 of 29** and
  says so: today the residual is EMPTY and the gate covers the whole population. ⛔ The day that count moves the
  gate's claim narrows; the assertion is what tells you, and raising the number to make it pass inverts it.
- **The instrument is created INSIDE the test transaction and rolled back with it.** `create extension if not exists
  plpgsql_check with schema extensions` (available 2.8, not installed) runs inside `421`'s `begin; … rollback;`, so
  the catalog is untouched and nothing ships. ⛔ Installing it by MIGRATION was offered to the PO and **not taken**.
  ⛔ An unavailable extension must RED, never `skip`: `§ 0a` asserts availability before the create, `§ 0b` reads
  `pg_extension` rather than trusting the DDL's quiet exit.
- ⭐ **EVERY assertion sits OUTSIDE every savepoint**, and where an arm must mutate its result leaves the savepoint on
  a channel `rollback to savepoint` cannot reach: **`setval` on a temp sequence is non-transactional** (measured — a
  value set inside a savepoint survives its rollback; a row inserted into a temp table in the same savepoint does
  not). Each counter is seeded to **0 = the block never ran** and written as `value + 1`, so "the measurement did not
  happen" reads differently from "the measurement found nothing". The plpgsql arm needs no savepoint at all —
  `plpgsql_check_function_tb` is read-only — so its findings keep their text.
- **FIVE planted controls, each pinned to the arm it must red in** (`§ 3`): an unqualified plpgsql DEFINER on `''`
  (42P01) · its schema-qualified twin, which must NOT fire **and is asserted to have been EXAMINED** · an unqualified
  FUNCTION call (42883 — the live catalog raises only 42P01, so without this plant that half of the finding set is
  carried by no assertion) · a body that creates temp `_x` AND reads `profiles` unqualified, asserted as
  `_x=EXCLUDED | profiles=KEPT` in one string · a `language sql` DEFINER created on `search_path = public` and then
  moved to `''` by `ALTER`, asserted as `"" accepted by ALTER | 1 visited | 1 findings`. ⛔ A control that cannot red
  VOIDS its arm.
- **Both arms carry their own non-vacuity term in the same assertion as the property.** `§ 1a` counts the 18 members
  the checker actually returned for (a `left join lateral … on true`, so a clean member is not dropped); `§ 2a` reads
  `11 visited | 0 findings`, because `0 visited` would produce `0 findings` too and a findings-only assertion would
  read that as a pass; `§ 2b` proves the 11 definitions are byte-identical to their pre-savepoint snapshot.
- **The five carriers that said the half was UNGATED now name 421 and its residual bound**:
  `.claude/rules/migrations-forward-only.md` (re-worded within the 2048-byte cap, 2043 after) ·
  `scripts/gen-definer-search-path-freeze.mjs` header · `419`'s header (⛔ its assertions and its `§ 0` splice are
  byte-unchanged — gate 18 reads that block) · this seam's `## Current state` bullet · `docs/lint-gates.md` gate 18.
  ⛔ The follow-up is cited as **closed by 421**, not deleted.
- ⚠ **What 421 does NOT claim.** It is not a security proof: it proves each body RESOLVES under `''`, which is D4's
  clause, not that no `pg_temp` shadowing is possible for a body that legitimately uses a temp table (that mechanism
  is `420`'s subject and is unchanged). It reads the LIVE catalog, so like `419` it buys *"the next Phase Gate
  noticed"* and not *"the next commit refused"* — ⛔ and it is in `npm run test:db`, never in `npm run lint`, because
  it opens a database.

**What this seam should say from here:** ADR 0208 D4 is gated in BOTH clauses — the PATH by `419` + gate 18 over the
861 frozen non-empty paths, the BODY by `421` over the 29 empty-path DEFINERs, the two populations asserted to
partition the 890; the body gate's only residual is the `execute` class, held at zero and stated rather than claimed;
the `plpgsql_check` instrument lives inside `421`'s transaction and in no migration.

## The undeclared-`search_path` class has ONE owner and ONE remedy (2026-09-12, unit `DEFINER-UNDECLARED-CLASS-REMEDY`; ADR **0208** D4; PO ruling **2026-09-11**; ⛔ NO migration, NO new gate)

**What is now true, each with its home — witnesses (the TAP figures, the six mutation runs, gate exit codes) are in
the record's § Session log, ⛔ not restated here:**

- **The class is a DEFECT with a named remedy, and the remedy is written where the red appears.** A `prosecdef`
  function in `app`/`public`/`authz` carrying **no** `search_path` converges to `set search_path = ''` with
  schema-qualified object references (ADR 0208 D4). `414 § 0b`'s message now says exactly that — ⛔ never by widening
  `414` or `419` to admit the member, and never by adding it to the frozen set. The PO ruled it on **2026-09-11**
  ("*a defect to converge to `''`, never a member to add to any frozen set … No new cell*"), closing
  `FUP-DEFINER-QUALIFIED-BODY-GATE-UNDECLARED-CLASS-NOW-HAS-A-LIVE-ENFORCER` on its SECOND branch.
- **ONE owner, and the second gate points at it rather than competing.** `414 § 0b` names the offender and the
  remedy; `421 § 0c` counts the class as its `undeclared` term and its message names `414 § 0b` as the owner of that
  finding. ⛔ No third assertion was built — the ruling says *no new cell*, and a class with two remedial messages is
  the shape that produces two divergent fixes.
- ⛔ **THE CLASS IS IN NEITHER GATE'S DOMAIN, AND NOT — as `421`'s header claimed until now — "counted on 419's
  side".** `scripts/definer-search-path-census.sql`'s `definer_nonempty_domain` block COALESCES a missing value to
  `'""'`, so an undeclared DEFINER is `sp_nonempty = false` and never enters the frozen set `419` ratchets; `421`
  reads only the EMPTY form. The false clause was true of the PRINTED STRING and false of the catalog — the census
  comment carries the same correction, outside gate 18's byte-compared block.
- **`421 § 0c`'s `non-empty` term now EXCLUDES `<none>`, so the partition line's arithmetic matches the catalog it
  describes.** It read `sp <> '""'`, which is TRUE for `<none>`: a newcomer printed as
  `891 = 862 non-empty (419) + 29 empty (421) | 1 undeclared`, double-counted onto the term that names a gate whose
  domain it is not in. It now moves the TOTAL and `undeclared` only. ⛔ The expected string is UNCHANGED
  (`890 = 861 non-empty (419) + 29 empty (421) | 0 undeclared`) — the fix is visible only when the class is non-empty,
  which is why it needs a control and not a re-read.
- ⭐ **Both messages are now proven able to appear, which is the half a ruling cannot supply.** `414 § 2d` plants a
  DEFINER with no path and asserts `sp is null` LISTS it and NOT its `''` twin (`z414_ctl_empty_form`, already
  planted) — the twin half matters because a predicate conflating EMPTY with ABSENT would red on every DEFINER that
  converged, i.e. on exactly what D4 orders. `421 § 3h` plants the same two shapes and asserts the four partition
  counts as DELTAS: `total +1 … undeclared +1` for the undeclared plant, `empty +1` for the twin.
- **`421`'s four partition counts are defined ONCE, in `v421_partition`, which `§ 0c` formats and `§ 3h` moves.** ⛔ A
  control holding its own hand-written copy of the production expression certifies itself; the delta form also keeps
  the baseline in ONE place, so a future convergence re-baselines `§ 0c` and not a second literal.
- ⚠ **`414 § 0b`'s predicate and its expected `''` are UNCHANGED** — only its message moved. The 890/890 figure stays
  in the section comment as a DATED measurement (2026-09-03), not as a live claim.
- ⚠ **What this does NOT do:** no migration, no policy, no ADR (D4 already rules the VALUE; the PO ruled the class).
  It does not converge any function — the live population is **0 undeclared** on 2026-09-12, so the remedy has no
  subject yet and the change is entirely about what the red will SAY on the day it does.

**What this seam should say from here:** the undeclared-`search_path` DEFINER class is RULED, not open — a defect
that converges to `search_path = ''` with a schema-qualified body, owned by `414 § 0b`, counted by `421 § 0c`, kept
out of the frozen set by the census's coalesce, and proven able to red by a control in each file. ⛔ A future member
is fixed by converging it; widening `414`, `419` or the census domain to admit it would only make the gap invisible.

## The role catalog holds roles — `platform_role` retired, `administrativo` out of `authz.roles`, one `assume_role(text)` (2026-09-12, unit `AE5-ROLE-CATALOG-COMPAT`; ADR **0207** D5 steps 1–5; migration `20261003007430`)

**What is now true, each with its home — witnesses (the red-first TAP figures, the arm and sweep exit codes, the E2E
run) are in the record's § Session log, ⛔ not restated here:**

- **`app.active_role_selections.role` is `text` under `active_role_selections_role_fkey → authz.roles(code)`** (NO
  ACTION), values preserved through `using role::text`. Consequence: a catalog row whose code a live session has
  seated is undeletable (`23503`) until that selection row is gone — `408 § 4` clears its own selection rows first,
  declared in the file as fixture cleanup. `public.custom_access_token_hook(jsonb)` still reads the column
  (`role::text`, a no-op cast now); `app.can_read_professional_profile` names the table in a comment only.
- **`public.assume_role` is ONE routine, `(p_role text)`**, `prosecdef`, `proconfig = {search_path=""}` (⚠ the token is
  `search_path=""`, not `search_path=` — a probe on the latter reads the whole empty-path population as 0), body
  schema-qualified and resolved by `421`'s plpgsql arm; ACL re-issued (`postgres·service_role·authenticated = X`, PUBLIC
  revoked — a fresh function's NULL `proacl` includes PUBLIC). The three gates and their order are unchanged:
  `session_selectable` fail-closed → `app.is_active(v_uid)` → the real assignment (`profiles.is_admin` for
  `platform_admin`, a live `memberships` row otherwise); same pt-BR messages, same SQLSTATEs (`28000`/`42501`); the
  audit row stamps the role only. ⛔ An unknown code fails `42501` (selectability, fail-closed), never `23503`.
  Both halves of the seating gate now carry a mutation: `408 § 3` (catalog row flipped) and `408 § 5` (the caller's
  membership EXPIRED — ⚠ expiry, never delete: a delete cascades and the refusal would then be attributable to collateral
  damage, not the assignment gate; a sibling still seats); `422 § 2` holds the structural pins.
- **`public.platform_role` is DROPPED** (`to_regtype` → NULL), after a DO block asserted zero non-internal `pg_depend`
  dependents. The **`419` frozen set shrank by exactly one** (`public.assume_role(p_role platform_role)` removed, nothing
  added — gate 18's pure-deletion rule held); `421 § 0c` re-pinned `890 = 860 non-empty + 30 empty | 0 undeclared`.
- **`authz.roles` = 11 rows, all `session_selectable`**; `administrativo` deleted after DO blocks asserted zero
  `role_permissions` / `memberships` references. **`authz.scope_kind`'s CHECK is exactly
  `organization·hospital·commission·none`** — an `ALTER DOMAIN … DROP CONSTRAINT` + re-add, preceded by a DO block
  proving no `public.memberships` row carried `capability_plane` (the domain also types that column); `422 § 4`
  proves it red-first against a PLANTED row (the plant must drop the domain constraint too, found by running the cell
  in BOTH states) and that a `capability_plane` insert now fails `23514`. `authz.role_permissions` untouched (still
  `staff_admin` only).
- **The TS side has ONE declaration site** — `ROLE_MANIFEST` in `src/lib/role/role-catalog.ts` (code, label, scope
  kind, session-selectable, landing branch, fallback, precedence = order); `PlatformRole` is inferred from it, and
  `ROLE_LABELS`/`ROLE_SCOPE_KIND`/`ROLE_ORDER`/`ROLE_BRANCH`/`LANDING_BRANCHES`/`scopeSummary` are derived compat
  exports with every name, type and value preserved. The DB binding is a generated artifact
  (`supabase/tests/vectors/role_manifest.psql`, `scripts/gen-role-manifest.mjs`): **gate 19** (`lint:role-manifest`,
  text-only) proves artifact == TS manifest; **pgTAP `411`** proves artifact == `authz.roles`; ⛔ neither half alone
  is the verdict, and `system_managed` / `state` have NO TS twin (pinned by 411 only — the gate prints that bound).
- ⛔ **Step 6 NOT taken, proven**: `app.member_can(uuid,text)` and `app.member_can_for(uuid,text,uuid)` md5-unchanged
  (`422 § 5` pins both); `authz.capability_permissions` does not exist; the three narrower codes stay OWED at
  proposed-order item 6 and ⛔ may not be mapped to the two broad codes meanwhile (ADR 0207 § Consequences).
- **Three catalog mirrors the unit's opening map did not name broke on the ROW deletion, not the rename** —
  `vectors/authz-enforcement-manifest.json` (`roles`), `vectors/authz-matrix-axes.json` (`catalogRoles`; cell counts
  unchanged at 2002 / 1728, so it is a roster, not a grid dimension) and `400_data_access_census.sql § 2`'s RPC digest
  (reds while `lint:data-access` stays green — that gate never opens a database). ⚠ A rename-keyed sweep is blind to a
  VALUE-keyed mirror; the class is *12-row rosters of the catalog*, and `grep -rn "administrativo" supabase/tests
  scripts src` is the enumerator, not a signature grep.
- **Six cells lost their subject and were RE-CAST, never deleted** (`411 § 2.x`, `§ 5.1`, `§ 5.2`; `401 § 3.4`,
  `§ 3.6`, `§ 14.5`) — old → new predicate in the record. The new door was **outside the predicate arm's domain**
  (returns `void`): the deriver exits 1 and the discharge is the TARGETED command-door case (`CASE 2` of
  `authz-command-door-targeted-cases.sh`, COVERED), ⛔ not a `CASES=` entry.

## The candidate fan-out gets its six-clause shape assertion — pgTAP `423` + P2 `§ 5` (2026-09-13, unit `AE4-D-SHAPE-ASSERTION`; ADR **0208** D2 built, D3 triggers tabled; ⛔ **NO migration**, NO catalog change, NO producer factoring)

**What is now true, each with its home — witnesses (the red-first table per cell, the P2 `§ 5` line, the gate rc's) are in
the record's § Session log, ⛔ not restated here:**

- **Six clauses, one file.** `supabase/tests/423_ae4_d_shape_assertion.sql` (`plan(33)`) asserts ADR 0208 D2's clauses
  1 · 2 · 3 · 5 · 6 and the transaction-measurable half of 4 (`D ≤ F`) over a deterministic slice of the seeded
  population (principals with ≥ 1 fact, `order by id limit 40`, × 3 kinds); four VACUOUS guards RED when the slice loses
  a polarity, never skip. Three instruments: **I1** the candidate CTE cut from `pg_get_functiondef` by ONE anchored regex
  and EXECUTED with parameters substituted BY NAME (every anchor RAISES when absent — the inverse of a hand copy, which is
  green while production drifts); **I2** `authz.assignment_facts(p)` × every scope of the kind through the LIVE
  `authz.scope_reaches` (`raw = count(*)`, `D = count(distinct)`), whose own correctness rests on `412`; **I3** the P2
  counter, ⛔ NOT used in the file. ⭐ I1 and I2 are independent because the ascent exists TWICE in the catalog — the
  CTE's inline `CASE` (producer side) and `scope_reaches` (confirm side, via `entailed_grants` / `explain_permission`).
- **Clause 5 on the LIVE bodies.** The two resolvers' CTEs normalise (`--` comments stripped, whitespace collapsed) to the
  same md5; raw text differs on the signature, three comment lines and the confirmer, exactly as ADR 0208 measured. The
  5.x cells: equality after normalisation; each extraction contains NEITHER confirmer; the confirmer swap leaves the
  producer md5 unchanged while the body predicate flips (the falsifiable replacement for a planned `isnt(raw, raw)` cell
  that could not fail — signatures always differ).
- **Clause 6, the provider family as a PROPERTY**: schema `authz` + identity arguments `uuid` + result
  `TABLE(role_code text, scope_kind text, scope_id uuid)`, read live; today `{authz.assignment_facts}`, consumed by 2/2
  CTEs; a planted `authz.administrativo_facts(uuid)` REDS `6.2–6.4`. ⚠ Bound: a provider in another schema, another
  arity or row-type spelling, behind a wrapper or a view is NOT in the family — stated in the file, not closed.
- **`U` has ONE home — `scripts/authz-ae4-p2-invocation-count.sql § 5`**, at top level on the loaded AE4 perf fixture:
  `ΔU` as `authz.has_permission` invocations against an I2-derived `D` (never off the counter), plus a dedup-removed
  discrimination half. ⛔ MEASURED, not preferred: the function-call counter publishes nothing inside a transaction
  (Δ = 0 with and without `pg_stat_force_next_flush()`; Δ = 1 at top level), and the `dblink` side session is closed on
  this stack (`postgres` is `rolsuper = f`; `dblink_connect_u` is `supabase_admin`-only). ⇒ `npm run test:db` never
  measures the confirmation COUNT, and the fixture run is one principal × one kind.
- **Every 33 cells have an observed red** — six catalog plants by anchored surgery on the live definitions inside
  savepoints (fact-independent candidate · one-to-many `scope_reaches` · dedup token removed (the file ABORTS) · an ascent
  arm removed · one CTE token · a planted adapter) and seven harness plants on scratch copies for the cells no subject
  change can red; probes leave the savepoint on temp sequences as `value + 1` (0 = never ran). ⚠ `0.2`/`0.3` red by
  REFUSING (the instrument aborts), a stronger failure mode with a weaker witness.
  ⚠ **Superseded 2026-09-13, same unit (commit `d921e8be`)** — the sentence above described the DEFECT the set-valued
  arm then exposed: an aborting file moves the run shape and turns COVERED into NOTICED. `423` now never raises out of
  the file — every instrument refusal is recorded in a temp table and asserted as a RED TAP line (`0.2`/`0.3` are
  ordinary `ok()` cells), every dependent predicate is NULL-safe toward red, `plan(33)` is always fully emitted, and
  the arm reads `RESULT: CLEAN` with `423` in both resolver cases' reddened set. See the record § Session log, entries
  *gate step 1, first pass* and *the abort fix*.
- **ADR 0208 D3's five triggers are tabled in the record** with what each invalidates and what watches it: 1–2 →
  `423 § 6`; 3 → `423 § 2` (blind to an expansion applied identically to BOTH artifacts); 4–5 `prose only`.
- **What this buys**: *"the next Phase Gate noticed"*, never *"the next commit noticed"* (ADR 0195) — a live-catalog
  count cannot live in `npm run lint`. `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED` closes on this unit's landing.

## The two catalog-driven vitest suites pin the membership role SET (2026-09-13, unit `VITEST-ROLE-SET-PIN`; closes `FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT` on its 2026-09-13 re-clause; ⛔ **NO migration**, NO catalog change, NO `src/` behaviour change — test-only)

**What changed on the TEST side of this seam, and why it is recorded here.** The unrouted-role class guard
(`src/lib/queries/session-grants.test.ts`, ADR 0101) and the ACT S4 nav-scope guard
(`src/components/shell/nav-scope-exclusivity.test.ts`) both enumerate `public.memberships_role_check` from
`pg_constraint` at import and generate one case per role (three `it.each` blocks between them, 3N cases). Each
used to carry its OWN copy of the reader; neither pinned what the read should return, so a read taken inside a
`supabase db reset`'s partial-CHECK window generated fewer cases and stayed green — pgTAP `292` pins the
vocabulary bidirectionally but structurally cannot see that window (it reads the same database at a different
time).

**Now.** `src/lib/role/membership-role-vocabulary.test-support.ts` exports two FUNCTIONS and no module-scope value:
`expectedMembershipRoleVocabulary()` — `ROLE_MANIFEST.filter(scopeKind !== 'none').map(code).sort()` — and
`readRoleVocabularyFromCatalog(guardName)`, the one reader (the `docker exec … psql` over `pg_get_constraintdef`,
fail-closed on a stack that is down and on zero roles). Each suite keeps its own read and asserts set equality
against the derived set. ⛔ The derivation is not a new hand literal: the manifest is bound to the live
`authz.roles` by gate 19 (`lint:role-manifest`) + pgTAP `411`, and QA measured the filter to be catalog-enforced —
`memberships_role_scope_kind_fkey` is `(role, scope_kind) → authz.roles(code, allowed_scope_kind) MATCH FULL`, so a
`none`-scoped role structurally cannot hold a `memberships` row.

**Witness.** Short-read plant (one role filtered out of each read): both pins red, run shape 37 → 34 (one case per
generated block per missing role). Substitution plant (`staff` → `stafx`): count unchanged at 37, pin red — the
case a `.length` assertion cannot see. Gates on a fresh reset: `npm run test` 154 files / 2094, `npm run lint` rc 0
(19 gates), `npm run typecheck` rc 0; `test:db`, the authz arms, the door sweep and `e2e:prod` NOT owed.

**Open edge filed.** The reader is now an EXPORTED function in a non-test `src/` module that shells out to Docker,
kept out of application code by prose and the `.test-support.ts` suffix only (zero app importers today):
`FUP-VITEST-ROLE-SET-PIN-TEST-SUPPORT-MODULE-IS-APP-IMPORTABLE` (🟢, PO to rule).

Record: [`../progress/vitest-role-set-pin.md`](../progress/vitest-role-set-pin.md) · hub:
[`../features/vitest-role-set-pin.md`](../features/vitest-role-set-pin.md).

## AE5 increment 1 — `staff` runs on layer 3, and two defects the re-key itself created (2026-09-14, unit `AE5-STAFF`, T6+T7; ADR **0211**; lead rulings **L13′/L15/L17→L24**; migrations `20261003007460` + `20261003007470`, **2**; pgTAP `424` · `425` new, `410` `plan(45)`; **NO flag — the migrations ARE the cutover**) — ⛔ **NOT PUSHED: local only**

`staff` is the second role to leave layer 1. T6 flipped it `legacy → authoritative` behind a
count-verified block; T7 re-keyed its **20 permission codes** onto layer-3 domain authorizers in
ONE atomic migration: **21 doors** (13 granted to `authenticated`, **8 DEFINER-only**), **41
policies**, **23 function re-emissions**, the C1 wiring, and the enforcement manifest + its emitted
fixture + `410` moved in the same commit so the record and the catalog cannot land apart (PO ruling
R-4). The countdown moved **58/3 → 38/23**.

### ⛔⛔ TWO DEFECTS, BOTH INTRODUCED BY THE RE-KEY, BOTH FOUND BY VERIFICATION BEFORE THE COMMIT

**A WIDENING — an `or` that walked around the hard denies (lead ruling L24, superseding L17).**
Row 9's member-surface door was first written as
`authz.has_permission(…, 'commission.cases.deliberation.read') or app.has_case_capability(…, 'read_case_deliberation')`.
The SECOND disjunct routes through `app._case_caps`, which applies STEP-4's `is_case_respondent` /
`is_recused_from_case` denies and guards its S5 member-default arm with `not v_eg`
(`explicit_grants_only`). The FIRST applies **none of them**, and one true disjunct grants. Measured:
a plain member reached an `explicit_grants_only` case and an **EXCLUDED RESPONDENT reached his own**
(`233` M6·7 `have: true / want: false`, twice); `241` K5 / `242` K14 / `243` A26 / `228` QA MAJOR-3
returned deliberation substance where they pin `NULL`. **Class-1 case content (Architecture Rule 12).**
The door is now the capability arm **ALONE**; the permission is enforced one level down, inside S5.
Row 9's `residualLegacyAuthority` is **WITHDRAWN** — nothing residual remains — and the grant chain
is declared hop by hop.

**A NARROWING — a mechanical substitution across a SIGNATURE CHANGE (lead ruling L20).** T7's first
draft rewrote `_case_caps`'s S5 as `app.can_cases_deliberation_read(v_commission, p_uid)`. That door
is **CASE-keyed**; both arguments are `uuid`, so it compiled, resolved `cases.id = v_commission`,
found nothing, and made `committee_member_default` **permanently false** for every member on every
case. It fails CLOSED. Closed by a 21st door,
`app.can_cases_deliberation_read_in_commission(p_commission_id, p_user_id)` — permission arm alone,
DEFINER, `search_path = ''`, and **NO EXECUTE grant to anyone** (its only caller is a DEFINER body),
which is why it does **not** move R-4's ceiling. ⛔ Calling the case-keyed door from inside
`_case_caps` would be infinite recursion (`has_case_capability → _case_caps`), which is why a sibling
exists rather than a fixed argument. Swept: across all 20 doors, **exactly ONE wrong-keyed call site
ever existed**.

### Witnesses (fresh reset, subject `00000000-…-000a`)

| case | conditions | `_case_caps` | door | member surface |
| --- | --- | --- | --- | --- |
| `d0000000-…-00c1` `commission_default` | plain member, NO case grant | 2 | `t` | `t` |
| same | `staff`'s role-permission grant DELETED | 0 | `f` | `f` |
| same | restored | 2 | `t` | — |
| `ca000000-…-00e1` `explicit_grants_only` | **EXCLUDED RESPONDENT** holding the `staff` role **AND** an explicit `read_case_deliberation` grant | **0** | **`f`** | **`f`** |

Gates on a fresh reset: `test:db` **275 files / 9215 tests**, one red and it is the tester's `425`
(`3.1 have: 45 / want: 0`, `3.2 have: 48 / want: 57`; `§ 2.0` back to 47/47) — the pre-T7 baseline
was 273/9156/PASS, so that is a comparison and not a recollection. `npm run lint` rc 0,
`npm run typecheck` rc 0, gate 18 in sync, `gen:types` **no diff** (the 21st door is not a PostgREST
surface, and its absence is measured). **BUDGET-ANCHOR unchanged: app=339 / public=433 / total=772.**

### What the instruments learned, because none of them saw either defect

- **`410 § 6.2` is blind to an `or`.** Its closure DOES reach `is_case_respondent` — down the second
  disjunct — so row 9's committed `respondent_exclusion` measured as **satisfied** while the granting
  arm walked around it. A deny present in a closure is not a deny on every grant path; `§ 8.1` ("the
  site reaches the code" — it did) and `§ 3.5` ("the composedWith authority is present" — it was) are
  blind the same way. Filed: `FUP-AE5-STAFF-HARD-DENY-CLOSURE-IS-BLIND-TO-OR-AROUND`, which keeps
  L17's two-arm door **verbatim** as the closing gate's fixture.
- **A re-keyed row used to SHED its per-arm data.** `subject`/`hat` (ADR 0201 D3) lived only on
  `armInterface`, which a row drops when it re-keys. T7 re-keyed 20 rows at once and all 20 subject
  declarations vanished — and nothing went red: the differential generator's `subject_keying()`
  returned null for every row and arm14(b) compared null to null. **VOID, not red.** L21 moved the
  declaration onto `enforcementSites`, `subject_keying` reads either surface, the mutation helpers
  now **refuse by name** instead of walking off the end of the row list, and `410 § 3.8` checks each
  explicit-principal subject against the live signature.
- **`reaches_code` sees one hop.** A policy routed through a domain wrapper read as "declared but not
  enforcing". L23: follow the manifest's **own** `composedWith` declaration, verifying each hop in the
  catalog, depth-bounded — so an **UNDECLARED** two-hop route still reads as not-reaching, which is
  the finding the arm exists to make.
- **A mutation twin can go DEAD without going red.** `319` A7 planted on `app.has_role_any`; L20/L24
  moved S5's hat gate to `authz.holds_role` (measured: neither `authz.has_permission` nor
  `authz.holds_role` calls `app.has_role_any`), so the plant mutated a function S5 no longer consults
  and read `have: 64 / want: 66` — landing perfectly while changing nothing. Re-pinning 66 → 64 would
  have asserted that a no-op is a no-op. Re-pointed, and re-pinned 66 → **111**: S5's bit plus the
  whole S1 coordinator set, with `read_restricted_phi` (16) still **absent** — D5·6 holding under the
  mutation.
- **`ADR 0208 D4` "converge on touch" cost 24 signatures**, `419` 860 → **836**, a **PURE DELETION**
  (0 added). Seven pins across `176` / `274` / `326` / `328` / `329` / `341` / `371` asserted the
  legacy `search_path` or a retired `is_member_of` arm **as a property to keep**; their TEXT was
  corrected, not their numbers alone — a pin that matches a dead name defends the name and stops
  defending the arm.

Record: [`../progress/ae5-staff.md`](../progress/ae5-staff.md) · hub:
[`../features/ae5-staff.md`](../features/ae5-staff.md).
