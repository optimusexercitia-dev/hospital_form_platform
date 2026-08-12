# QA review — follow-up batch 2026-08-12 + REG·KIND (ADR 0110)

**Reviewer:** `qa` · **Date:** 2026-08-12 · **Method:** live catalog (`pg_proc` incl.
`prosecdef`, `pg_policies`, `pg_constraint`, `pg_trigger`, ACLs / column privileges) +
rolled-back behavioural probes under `set local role authenticated` with real
`request.jwt.claims` hats. Migration text was used only to locate things; every
schema/RLS/RPC claim below was resolved against the catalog.

**Verdict: `APPROVED`** — with 6 non-blocking follow-ups, two of which are
confirmed-live, **pre-existing** security defects outside both review scopes (Findings 1
and 2). Full reasoning at the end of this document.

**Catalog freshness check (prerequisite):** `supabase_migrations.schema_migrations`
holds **359** rows; `supabase/migrations/*.sql` is **359** files; head is
`20260921000300`. The live catalog therefore reflects HEAD **plus** all three
working-tree migrations. All findings below are against that catalog.

---

## FINDING 1 — `redact_referral_note`'s masking is bypassable through the sibling mutator doors (CONFIRMED, live)

### Scope classification

**PRE-EXISTING.** Not introduced by the follow-up batch and **not** introduced by
REG·KIND. It is surfaced by this review because FUP-PDF-3 / ADR 0111 in this very batch
defines the defect *class* and fixes exactly one instance of it.

- The two doors REG·KIND rebuilt — `create_referral_internal_note` and
  `update_referral_internal_note` — **also** return the full row type, but neither is
  exploitable: the creator supplies `body_md` itself, and the updater refuses outright on
  a redacted note (`'este registro foi redigido e não pode ser editado'`, errcode
  `HC0A9`, live in `pg_proc.prosrc`).
- The **exploitable** doors — `assign_referral_internal_note`,
  `conclude_referral_internal_note`, `unassign_referral_internal_note`,
  `redact_referral_note` — are untouched by this batch (Phase 22 / RDR).

**→ Therefore this finding does NOT block this batch.** It is a separate filing.

### The exact claim

`public.list_referral_internal_notes` — the read door — deliberately masks a redacted
note's body as `'[redigido]'`:

> `'body_md', case when n.redacted_at is not null then '[redigido]' else n.body_md end`
> — live `pg_proc.prosrc`; the same text appears at
> `supabase/migrations/20260920000200_referral_registros_shared_kind_vocabulary.sql:221`,
> and the live body matches it.

Four sibling `SECURITY DEFINER` doors declare `RETURNS referral_internal_notes` — the
**full row type** — and so hand back the **real, unmasked `body_md`** of a redacted note
to any caller who passes their (weaker) authority gate:

| Door | `prosecdef` | Gate (live `prosrc`) | Returns |
|---|---|---|---|
| `assign_referral_internal_note(uuid, uuid)` | `t` | `app.can_manage_referral_internal_note` | `referral_internal_notes` |
| `conclude_referral_internal_note(uuid)` | `t` | `app.can_edit_referral_internal_note` | `referral_internal_notes` |
| `unassign_referral_internal_note(uuid)` | `t` | `app.can_edit_referral_internal_note` | `referral_internal_notes` |
| `redact_referral_note(uuid, text)` | `t` | `app.can_manage_referral_*` | `referral_internal_notes` |

`app.can_edit_referral_internal_note` (live `prosrc`) resolves to:

```
n.author_user_id = p_uid  OR  n.assigned_to = p_uid  OR  app.is_staff_admin_of_for(n.committee_id, p_uid)
```

— i.e. it includes the **assignee**, who may be any active commission member
(`assign_referral_internal_note` gates the assignee only on `app.is_member_of_for`).

### Mechanism

1. `redact_referral_note` sets `redacted_at` but **not** `status` — a note can be
   simultaneously `redacted` and `open` (verified: no CHECK couples them;
   `referral_notes_concluded_shape` couples `status`↔`concluded_at` only).
2. `assign_referral_internal_note` requires `status = 'open'` but carries **no redaction
   guard**, so a redacted note can still be assigned.
3. `conclude_referral_internal_note` likewise carries no redaction guard, and returns the
   whole row.
4. The row type includes `body_md`, which is deliberately **not** in the `authenticated`
   column GRANT (the K-R5-2 hardening, ADR 0109 D1).

### Catalog evidence (not migration text)

- `pg_proc.prorettype` → `referral_internal_notes` for all four doors; `prosecdef = t`.
- `information_schema.column_privileges`: `authenticated` holds `SELECT` on **16 of 17**
  columns of `referral_internal_notes`; **`body_md` is the one withheld**.
- `pg_policies` on `referral_internal_notes`: exactly **one** policy,
  `referral_internal_notes_select` (SELECT, `authenticated`,
  `app.can_read_referral_internal_note(id, auth.uid())`). No INSERT/UPDATE/DELETE policy —
  all writes go through the DEFINER doors, so the doors *are* the boundary.
- `has_function_privilege('authenticated', …, 'execute')` = **true** for both
  `assign_…` and `conclude_…` (counted 2/2), and the `public` schema is PostgREST-exposed.

### Is this PHI (Rule 12)?

**Not the printed-document columns** — this is unrelated to FUP-PDF-3's
`verification_token` / `storage_path` / `revoked_by` / `revoked_reason`.

It is **referral internal-note free text**, which the platform itself classifies as
PHI-bearing, on two independent pieces of catalog evidence:

- `list_referral_internal_notes` emits a Rule 11 read audit with the comment *"a served
  note body is a PHI read → log THAT + WHO"* via `public.log_audit_access`.
- `app.dispose_referral_phi`'s live body contains
  `update public.referral_internal_notes` — note bodies are in scope for PHI disposal.

So: **Rule 12-adjacent free text inside a Rule 12 module**, plus a **Rule 11 audit gap**
(the mutator doors emit `referral.note_assigned` / `referral.note_concluded`, never
`referral.note_viewed`, so the body is served with **no read-audit row**).

### Who can reach it — named persona and path

**Persona:** `staff1.ccih@test.local` — a plain `staff` member of CCIH, hat
`active_role: staff`. Verified `app.is_staff_admin_of_for(CCIH, staff1) = false`.

**Path:** the coordinator (`chefe.ccih@test.local`) writes a note, redacts it, and assigns
it to `staff1`. `staff1` then calls, over PostgREST with nothing but their own session:

```
POST /rest/v1/rpc/conclude_referral_internal_note   { "p_note_id": "<id>" }
```

and reads `body_md` from the response body. No service-role key, no elevation, no
coordinator rights.

### How it was proven live (not theoretical)

A **direct read as a specific role** — a rolled-back transaction, `set local role
authenticated` with real `request.jwt.claims` including the ADR-0106/0107 `active_role`
hat, run twice with controls:

| Step | Result |
|---|---|
| **Control A** — `app.is_staff_admin_of_for(CCIH, staff1)` | `false` (persona is not a coordinator) |
| **Control B** — `authenticated` EXECUTE on `assign_…` + `conclude_…` | `2` of 2 (PostgREST-reachable) |
| **Control E** — direct `select body_md from referral_internal_notes` as `staff1` | **REFUSED, 42501** (the column GRANT works) |
| **F** — `list_referral_internal_notes` as `staff1` | `body_md = "[redigido]"` ← redaction working |
| **G** — `conclude_referral_internal_note` as the *same* `staff1`, same session | `body_md = "SEGREDO-CLINICO-XYZ"` ← **the real body** |

F and G in the same transaction, same role, same hat, is the whole finding: the read door
masks and the mutator door does not. Controls A/B/E rule out "the persona could read it
anyway" and "the door is unreachable". The probe was run twice, independently, with
identical results, and rolled back both times — no state was mutated.

### Severity

**P2 / MEDIUM.** It is a confirmed, authenticated-tenant-reachable defeat of a deliberate
masking control plus a Rule 11 read-audit bypass — but the reachable set is confined to
people already inside the note's own committee (author, assignee, coordinator). It is
**not** cross-tenant, **not** cross-committee, and **not** anonymous. There is no
privilege escalation; the loss is that *redaction does not hold against a committee
insider*, which is precisely the population redaction exists to constrain.

### BLOCKS?

**NO** — pre-existing, outside both review scopes, and the two doors this batch did
rebuild are not the exploitable ones. **File as a follow-up** (suggested `FUP-REF-NOTE-1`)
and fix with the shape ADR 0111 already establishes: a named composite mirroring the
`authenticated` column GRANT, or simply `returns void` / a narrow summary for the four
mutators, whose product callers ignore the returned row.

---

## FINDING 2 — `case_events.kind` is enforced only in TypeScript; a case writer can forge a procedural ethics event (CONFIRMED, live)

**Scope: PRE-EXISTING, but squarely in REG·KIND's blast radius** — REG·KIND widened this
exact CHECK (adding `update` / `follow_up`). It did not create the shape.

`case_events_kind_check` (live `pg_constraint`) admits **16** values: the 6 manual kinds
plus 10 system/procedural ones (`admissibility_decided`, `finding_recorded`,
`notification_issued`, `hearing_scheduled`, `vote_cast`, `decision_issued`,
`appeal_submitted`, `interview`, `safety_event`, `allegation_added`).

The only thing restricting a user to the 6 manual kinds is
`isCaseEventKind()` in `src/lib/cases/documents-actions.ts:292` and `:358`
(`src/lib/cases/registro-kinds.ts:isCaseEventKind`). At the database level there is
**nothing**:

- `pg_policies` on `case_events`: `case_events_writer_insert` /
  `case_events_staff_admin_insert` are direct INSERT policies for `authenticated`, and
  **neither predicate mentions `kind`**.
- `pg_trigger` on `public.case_events`: **zero** non-internal triggers.

This is an Architecture Rule 1 shape — *"never rely on UI hiding"*. The server action is
not the boundary; the table is directly writable.

**Proved live**, rolled back: as `chefe.ccih@test.local` (hat `staff_admin`), a direct
`insert into public.case_events (case_id, kind, body, visibility) values (…,
'decision_issued', …)` **succeeded**, returning
`kind = decision_issued`. A committee writer can therefore fabricate a procedural
ethics-lifecycle entry in a case timeline over PostgREST.

**Severity: P2 / MEDIUM. Does NOT block** (pre-existing; the widening REG·KIND performed
is 2 benign manual values). Suggested follow-up `FUP-CASEEV-KIND-1`: either split the
CHECK so direct writers are confined to the manual subset (system kinds written only by a
DEFINER door), or add a `with_check` arm on the two INSERT/UPDATE policies.

---

## FINDING 3 — `npm run lint` (the §8 five-gate chain) exits 1, so gates 2–5 never run

**Scope: PRE-EXISTING infrastructure, surfaces on every machine with a started stack.**

`npm run lint` is `eslint --max-warnings=0 && lint:css-vars && lint:memberships-door &&
lint:client-server-imports && lint:vacuous`. Measured here: **exit 1**, 186 problems
(154 errors / 32 warnings). Every one of them is in a single file —
`supabase/.temp/start-secrets/supabase_edge_runtime_.../main/index.ts`, a Supabase CLI
artifact. It is gitignored (`supabase/.gitignore:3`) but **not eslint-ignored**.

Because the chain is `&&`, gate 1's failure means **`lint:css-vars`,
`lint:memberships-door`, `lint:client-server-imports` and `lint:vacuous` never execute**.
That is the "a gate summary can hide unrun tests" class: the command CLAUDE.md §6 step 1
names as the gate silently delivers one fifth of it.

I verified the batch's own claim rather than assuming it:

| Check | Result |
|---|---|
| `npx eslint src e2e --max-warnings=0` | **exit 0** — first-party is genuinely 0 errors / 0 warnings |
| `lint:css-vars` | exit 0 |
| `lint:memberships-door` | exit 0 — "no raw DML on memberships, hospital_affiliations in src" |
| `lint:client-server-imports` | exit 0 — 0 findings |
| `lint:vacuous` | exit 0 — **178 spec files, 0 findings** (matches the recorded evidence exactly) |
| `npm run typecheck` | exit 0 |

So the batch's substance is clean and the recorded "known pre-existing" framing is
accurate as to cause. **Does NOT block**, but the fix is one line (add `supabase/.temp/**`
to the eslint config `ignores`) and it restores a gate the project depends on. Recommended
inside this batch. Suggested `FUP-LINT-TEMP-1`.

⚠ Related process note: the earlier reading of this gate returned "exit code 0" because
the command was piped through `tail` — `tail`'s status, not npm's. That is the repo's own
recorded trap. Gate results must not be read through a pipe.

---

## FINDING 4 — FUP-PDF-3's central invariant is asserted in prose only, not executably

**Scope: THIS BATCH (FUP-PDF-3 / ADR 0111).**

`supabase/migrations/20260921000100_…sql` states the design's load-bearing claim:

> *"making the doors return the same surface means the two can never diverge in the
> caller's favor — a future column joins the composite only when it also receives its own
> GRANT"*

Nothing enforces that. pgTAP 323 (13 tests) pins the *current* withheld columns by name
(t4/t5, t7/t8) and preserves door properties (t10–t13), but **no assertion compares the
set of `printed_document_public` fields to the set of `authenticated`-granted columns of
`printed_documents`**. A future column added to the composite without a matching GRANT —
the widening direction — passes 323 green.

This is the repo's own *"a comment is an assertion that goes stale silently"* class (hit
4×, one of which shipped a live bug). The fix is one query:

```sql
-- set(composite fields) must equal set(authenticated-granted columns)
```

**Severity: MINOR. Does NOT block.** Recommended as `FUP-PDF-3a`.

---

## FINDING 5 — stale comment referencing the retired bucket

`src/lib/queries/meetings.ts:261` still reads *"the file lives in the private
`meeting-attachments` bucket"*. That bucket no longer exists (verified: absent from
`storage.buckets`). `src/lib/meetings/actions.ts:894` and
`src/components/meetings/attachment-upload.tsx:31` also describe it as a live allow-list
source. The migration's own audit called these "aria ids and comments"; two of the three
are comments that now assert something false.

**Severity: TRIVIAL. Does NOT block.**

---

## FINDING 6 — the three "structurally fixed" alert-dialog sites: wiring confirmed, behaviour still unmeasured

**Challenge 1, answered.** Structural coverage **holds for all six sites** — I checked each
one rather than taking the count on trust. All six import from
`@/components/ui/alert-dialog` and render `<AlertDialog open={…} onOpenChange={…}>`, so
each gets `DialogFocusRestoreProvider` (capture) and the wrapper's
`AlertDialogContent` (restore):

| Site | Controlled `open` | Wrapper | Measured? |
|---|---|---|---|
| `src/components/users/user-lifecycle-actions.tsx:155` | yes | yes | measured |
| `src/components/responses/wizard/orphan-warning-dialog.tsx:45` | yes | yes | **now measured** — `e2e/phase5-wizard.spec.ts` asserts `el === document.activeElement` directly |
| `src/components/meetings/minutes-audio-slot.tsx:37` | yes | yes | **no** |
| `src/components/meetings/review/conclude-bar.tsx:61` | yes | yes | **no** |
| `src/components/users/affiliations-panel.tsx:356` | yes | yes | **no** |
| `src/components/documents/document-actions-menu.tsx:130` | yes | yes | n/a (declared never broken) |

I also verified the module's load-bearing timing claim against the installed source rather
than the doc comment: `@radix-ui/react-focus-scope/dist/index.mjs` uses
`React.useEffect` **only** (two sites, lines 35 and 71) — no `useLayoutEffect`. So
`DialogFocusRestoreProvider`'s layout-phase capture does run before FocusScope moves
focus. **The claim is correct.**

The residual risk is **not** structural, and structural verification cannot reach it:
`useRestoreFocusOnClose` deliberately falls through when the captured element is
`!target.isConnected` or `disabled` (`src/components/ui/dialog-focus-restore.tsx`), in
which case focus lands on `<body>` exactly as before the fix. All three unmeasured sites
are **destructive-confirm** flows whose opener button plausibly unmounts or is replaced on
the confirm path — the precise condition that triggers the fall-through. The cancel path
(where the opener survives) should restore correctly.

This is a real gap between "structurally fixed" and "verified fixed", and it is the
distinction the phase-gate cares about. **Severity: MINOR, does NOT block** — the fix is
never worse than the prior behaviour, and the module documents the fall-through honestly.
Recommend the tester add the same `document.activeElement` measurement used in
`phase5-wizard.spec.ts` to at least one confirm-path close. Suggested `FUP-RDR-001a`.

---

## Challenges answered — verification record

### Challenge 2 — both corrected premises hold

Both re-verified against the catalog, because *a correction can be wrong too*:

- **FUP-PDF-3: 4 withheld columns, not 2 — CORRECT.** `printed_documents` has **19**
  columns; `authenticated` holds column-`SELECT` on **15**. The 4 withheld are exactly
  `storage_path`, `verification_token`, `revoked_reason`, `revoked_by`. The composite
  `printed_document_public` has **15** fields, name-for-name identical to the granted set.
- **Reorder: the constraint was already deferrable — CORRECT.**
  `case_narrative_types_commission_position_key` is `condeferrable = t`,
  `condeferred = f` → **DEFERRABLE INITIALLY IMMEDIATE**, as the corrected premise says.
  And the real root cause verifies too: `position` is **NOT NULL**, and
  `archive_case_narrative_type`'s live body is `update … set archived = true` — it never
  clears `position`, so an archived non-last row does retain its slot.

### Challenge 3 — the two rebuilt DEFINER doors, property by property

Diffed from `pg_proc` myself, not from the backend's report:

| Property | `mint_printed_document` | `revoke_printed_document` | Expected |
|---|---|---|---|
| `prosecdef` | `t` | `t` | ✔ DEFINER preserved |
| owner | `postgres` | `postgres` | ✔ |
| `provolatile` | `v` | `v` | ✔ |
| `proleakproof` | `f` | `f` | ✔ |
| `proisstrict` | `f` | `f` | ✔ |
| `proconfig` | `search_path=app, public, pg_catalog` | same | ✔ pinned path preserved |
| `proacl` | `{postgres=X, service_role=X, authenticated=X}` | identical | ✔ **no PUBLIC** — the DROP did not fall back to the default ACL |
| `pg_get_function_result` | `printed_document_public` | `printed_document_public` | ✔ the only intended change |

`pg_type.typacl` for `printed_document_public` is NULL (default PUBLIC USAGE) — correct
and required for a return type; it grants no data access of its own.

**Backend's report is accurate: `returns` is the only changed property.** pgTAP 323
t10–t13 additionally pin this, including t11's `anon`-holds-no-EXECUTE control, which is
the right control for the DROP+CREATE ACL trap.

### Challenge 4 — the `20260921000300` apply-time guard

**The shape is right.** The `do $$ … raise exception … $$` guard fails **loud and
specific** (names the object count and the remediation) rather than stranding blobs behind
a dropped policy set. It is materially better than the prior backfill-guard incident,
which failed with an opaque 23514. Two further defenses verified in the catalog:
`storage.objects`→`buckets` FKs have no CASCADE, and `storage.protect_delete` is a real
trigger on `storage.buckets` requiring the transaction-local
`storage.allow_delete_query` opt-in — so a `SET LOCAL` that failed to take effect (e.g.
outside a transaction) would fail the DELETE closed, not silently.

**No reachable door survives.** Verified in the live catalog:
- `storage.buckets`: `meeting-attachments` **absent** (10 buckets remain;
  `referral-attachments` and `interview-attachments` correctly untouched).
- `pg_policies`: **zero** policies anywhere whose `qual`/`with_check` mentions
  `meeting-attachments` (a general sweep, not just the two dropped by name).
- `pg_proc`: **zero** function bodies mention it.
- `storage.objects`: **zero** rows in any bucket locally.

**Deployment risk to carry forward (not a defect):** the remote object count is still
unmeasured, so `supabase db push` against production may hard-fail at this migration.
That is the guard working as designed, but the operator must expect it — and note that
`20260921000100` / `000200` apply *before* it, so a failure here leaves those two applied.

### Challenge 5 — REG·KIND's table DROP

**Clean. Zero orphans.** A single catalog sweep across `pg_class`, `pg_policies`,
`pg_proc` (name *and* `prosrc`), `pg_trigger`, `pg_type` and `pg_constraint` for anything
matching `referral_note_type` returned **0 rows**. Source-side sweep of `src/`, `e2e/` and
`supabase/tests/` likewise found no live reference (the surviving `type_label` hits all
belong to unrelated vocabularies — `case_narrative_types`, `referral_types`,
`participant_type_label`). `e2e/referral-registros.spec.ts:475` even pins the removed
"Tipos de registro" button at `toHaveCount(0)`.

**The required default cannot strand rows.** `referral_internal_notes.kind` is
`text NOT NULL DEFAULT 'note'` with `referral_internal_notes_kind_check` admitting exactly
the six manual values, and `grant select (kind) … to authenticated` is present — the
column-grant rule this table lives under (`body_md` remains the one withheld column, the
K-R5-2 hardening, intact). Existing rows take `'note'`; the free-text `type_label`
snapshot is dropped without mapping, which the migration justifies as pre-launch. That
holds here — the RDR work that created `referral_note_types` was merged locally and never
pushed, so no remote rows exist to lose.

⚠ One prose correction: the REG·KIND commit message says the two `kind` columns share
"the identical CHECK". They do **not**. `referral_internal_notes_kind_check` admits the
6 manual values; `case_events_kind_check` admits **16** (the 6 plus 10 procedural). The
*intent* — that the referral's list equals the manual list — is correctly implemented; the
sentence is just loose. `src/lib/cases/registro-kinds.ts` documents the real relationship
accurately. No code change needed; noted so the next reader is not misled. (See Finding 2
for the consequence of the 16-value list being unguarded.)

### Additional verification performed

- **The `printed_documents` defect class, swept.** I did not stop at the fixed doors: I
  enumerated every `public` function returning the full row type of a table that has
  partial `authenticated` column grants. **26 doors** share the shape FUP-PDF-3 fixed
  (18 returning `case_referral`, 4 returning `referral_internal_notes`, 2
  `referral_messages`, 2 meeting tables). I then checked reachability rather than
  reporting the count:
  - the 18 `case_referral` doors gate on `app.can_manage_referral_source/target`, which
    resolve to `is_staff_admin_of_for` / `is_technical_director_of_for` — a **subset** of
    `app.can_read_referral_phi`, which is what `get_referral_detail` requires before
    serving `description_md`. **No PHI-tier bypass.** I checked this specifically because
    `can_read_referral_metadata` (plain `is_member_of_for`) is strictly broader and would
    have been a real hole; it is not reachable through these doors.
  - the `referral_internal_notes` doors **are** reachable by a non-privileged member —
    that is Finding 1.
- **`docs/deployment/coolify.md` §2.5's security claim, verified.** The doc asserts the
  admin set is "closed under the product" and warns against weakening the promote guard. I
  tested it: `authenticated` *does* hold column-`UPDATE` on `profiles.is_admin` and
  `profiles_update_self` *does* permit `id = auth.uid()`, so the closure rests entirely on
  the `guard_profile_privileged_columns_trg` BEFORE UPDATE trigger. Probed as a plain
  `staff` persona: `update public.profiles set is_admin = true where id = auth.uid()` →
  **REFUSED**, *"only an admin may change is_admin/is_active"*. **The doc's claim is
  true.** The §2.5 write-up is accurate, correctly scoped to disposition (a), and the
  cross-link into the Step 6.3 troubleshooting symptom is a genuine improvement.
- **a11y (FUP-ETH-A11Y-1 m3/m4).** The diff replaces explicit `id=` +
  `aria-invalid=` with `{...field.controlProps}` at ~15 sites — a shape that could
  silently *drop* `aria-invalid`. Verified at `src/components/ui/field.tsx:126-133`:
  `controlProps` emits `id`, `name`, `aria-describedby`, `aria-invalid: hasError ||
  undefined`, `aria-required`. **No regression**; every converted site that previously set
  `aria-invalid` now declares `hasError` to `useFieldIds`. The m4 live region is mounted
  unconditionally outside the `{open && …}` popup (correct — a region inserted already
  holding its text is not reliably announced), and its strings are deliberately disjoint
  from visible copy to avoid Playwright strict-mode collisions. All user-facing strings
  are pt-BR (Rule 10). The `<fieldset aria-describedby>` treatment for the checkbox-group
  error is the right call.
- **Rule 8 (generated types).** `src/lib/types/database.ts` is regenerated: both RPC
  `Returns` now point at
  `Database["public"]["CompositeTypes"]["printed_document_public"]`, and the previously
  empty `CompositeTypes` carries the 15-field composite. `src/lib/pdf-mint/actions.ts`
  narrows to a `Pick<>` of the table Row. Note the `as unknown as` double cast at
  `src/lib/pdf-mint/actions.ts:299` is an assertion, not a check — benign here (it narrows
  the all-nullable composite to the door's guaranteed shape, and the Pick is over-narrow
  rather than over-wide), but it does not deliver the compile-time coupling Finding 4 asks
  for.
- **Test quality.** pgTAP 324 carries a genuine behavioural keystone (`lives_ok` on the
  path that raised 23505), not a structural restatement; 325's t1 sweeps *all*
  `storage.objects` policies for the bucket name rather than checking the two dropped ones
  by name — the right shape for an absence assertion. E2E: the `test.fail()` KB-3 marker
  was correctly retired and folded back into KB-2 per its own written instruction, and
  `phase5-wizard.spec.ts` measures focus via `document.activeElement` rather than inferring
  it from a matcher.

---

## Not re-derived

The full `e2e:prod` pass (1084/0/2-flaky, 58 batches), the 186-file pgTAP suite, and the
`ARM=census` / `ARM=hat` / `ARM=floor` runs are taken from the recorded evidence — a
single reviewer cannot re-run an 18-40 minute gate. I independently re-ran `typecheck`,
all five lint gates, and every catalog and behavioural claim reported above.

The three items listed as known-pre-existing (the
`can_read_referral_internal_note` door-sweep `ERROR`, the `supabase/.temp` lint reds, and
`phi-remediation.spec.ts` REM-8/REM-9's honest skips) were **not** misfiled as new.

---

# VERDICT: APPROVED

Both scopes meet their requirements.

**The follow-up batch** is correct on every point I challenged. FUP-PDF-3's two DEFINER
doors survived the DROP+CREATE with every property intact including the ACL — verified
property-by-property from `pg_proc`, not from the report. Both "corrected premises" are
genuinely correct (4 withheld columns; an already-deferrable constraint whose real cause
was archived rows retaining `position`). The bucket retirement leaves zero reachable doors
and its apply-time guard is the right shape for a data-dependent migration. The
BUG-BOOTSTRAP-001 write-up makes a security claim that I tested and that holds. The a11y
work introduces no `aria-invalid` regression.

**REG·KIND (ADR 0110)**, reviewed here for the first time, is a clean table drop: no
orphaned policy, trigger, function, grant, FK, type or constraint survives
`referral_note_types` anywhere in the catalog, and no source reference remains. The
required `kind` default cannot strand rows, and the new column correctly received its own
column GRANT — the trap this table's hardening sets for every new column.

**Nothing found blocks.** The six findings are: two confirmed-live but **pre-existing**
security defects outside both scopes (Findings 1 and 2), one pre-existing gate-wiring
defect (Finding 3), and three minor items (Findings 4–6). Finding 1 in particular should
be filed and fixed on its own schedule using the exact pattern ADR 0111 establishes — this
batch defined the defect class correctly and fixed the instance it set out to fix; it did
not undertake to fix the other 26, and should not be held for them.

**Recommended follow-ups:** `FUP-REF-NOTE-1` (Finding 1, P2), `FUP-CASEEV-KIND-1`
(Finding 2, P2), `FUP-LINT-TEMP-1` (Finding 3, one line, restores four skipped gates),
`FUP-PDF-3a` (Finding 4), `FUP-RDR-001a` (Finding 6), plus the trivial comment fix
(Finding 5).
