# P3 substrate brief — measured facts + six build findings

**Read this before touching PDF·P3.** Companion to [the plan](./case-printing-p3.md) and
[ADR 0144](../decisions/0144-case-printing-dossier-lock-and-phi-fork.md). Everything here
was read from the **live catalog** (`pg_proc` / `pg_get_functiondef` / `pg_policies` /
`pg_class.relacl`) on **2026-08-25**, precondition checked first: **453 migration files ==
453 rows in `supabase_migrations.schema_migrations`**, so the catalog was current.

⛔ **READ THIS BEFORE ASSERTING ANYTHING ABOUT A RENDERED PDF (P4 will need it).** A
whitespace-sensitive needle over `pdftotext` output of a **watermarked** page is **not a valid
matcher**. Measured 2026-08-25: the needle `'54 anos'` (with the space) returned **1 on the identified
variant and 0 on the de-identified one** — which reads exactly like *"the de-identification floor is
still broken"*, the half ADR 0144 D5's whole rationale rests on, and was one step from being filed as
a defect against a fix that had just landed correctly.

**It was the matcher.** The de-identified prévia carries the `RASCUNHO` watermark, and the overlay
perturbs inter-glyph spacing at that x-position, so `pdftotext -layout` emits **`Idade:54anos`** with
no space. ⚠ **Every prévia and every draft carries that watermark**, so anyone repeating this check
hits it. **Normalise whitespace in the needle, and DUMP THE RAW BLOCK before believing a zero** —
dumping is what caught it. Same family as the `\y`/`\b` trap below and the path-spelling grep: **a
zero from a broken matcher is indistinguishable from a zero that means something.**

⛔ **Two extensions, both load-bearing for P4.** (1) **The trap is not confined to `Idade:`** — the
perturbation comes from the diagonal band's position, so **any** needle whose expected text sits under
it is exposed, which on a template test is most of the page. ⛔ **Do not "fix" it by pinning the
no-space form** (`Idade:54anos`); that just moves the trap to the next field. Normalise the extracted
text, or tolerate optional whitespace in the needle. (2) ⚠ **This failure mode is worse than a flaky
matcher, and that is why it nearly landed:** it returned **1 for identified and 0 for de-identified**
— not noise, but a *coherent, plausible story* pointing at the exact half the fix had targeted, with a
recently-changed code path and an author to attribute it to. **A wrong matcher that fails randomly
gets re-run; one that fails asymmetrically ALONG THE AXIS UNDER TEST gets believed.** A count answers
*how many*, never *what it actually saw* — and on a rendering pipeline only the second question
separates a defect from a matcher.

⛔ **A CLEAN TREE IS `case_print_revisions = 1`, NOT 0.** `seed.sql` closes a case and then inserts
`case_phases`, which fires the D15 revision trigger exactly once. Anyone checking *"is this tree
clean?"* against 0 **would reset a tree that was already clean** — and would likely do it mid-gate.
The other residue checks are unchanged: `printed_documents` 0 · `cases` 8 · storage objects in
`documents-*` 0.

⛔ **THE THIRD MATCHER TRAP, and the only one with NO SYMPTOM — every paired-edit sync has this
exposure.** The house idiom for a synchronised edit is *"read the expected string out of the source
rather than retyping it"*, which is right. But a naive `grep 'const NOT_FOUND ='` against a **two-line
declaration** (name on one line, value on the next) **matches the line and captures NOTHING** — and
comparing against that empty capture evaluates `'' === ''` and **passes, green, with no output to
inspect.** The `\y`/`\b` trap and the watermark-whitespace trap at least produce a wrong answer you
can look at; this one produces a pass. ⇒ **An empty or zero result from a shape-mismatched pattern is
not a failure signal — it is a silently empty truth value.** Span the newline (`=\s*\n?\s*'…'`) and
assert the captured length is non-zero before comparing anything.

⛔ **REPORT THE ERROR, NEVER THE TEST NAME.** A test name describes what the test *would* have
proven had it reached its assertion. A precondition failure means it never got there — so the name is
a description of an unexecuted claim. Measured 2026-08-25: a gate red on
*"AC-2a: opening case detail does NOT emit `case_patient.read`"* — a **PHI-audit** proposition, in a
file `backend` had just modified. The actual failure was a Playwright **strict-mode violation** on a
panel-visibility precondition; it never reached the audit assertion at all. Reporting the name would
have sent an engineer hunting a PHI-audit regression **that does not exist**, in code they had just
touched, which is the most convincing possible wrong lead.

⛔⛔ **AND THE META-LESSON THIS PHASE ACTUALLY EARNED — the broken-matcher mistake recurred INSIDE
the sweep for the broken-matcher mistake, one hour after being reported.** The sweep pattern was
`identifica..o` — **two** dots for `ção`, which is **three** characters. It returned a clean empty
result, from a pattern that could not match the very line it was copied from, and would have yielded
the conclusion *"only 1 site affected"*. The positive control caught it: **30 sites, not 1.**

⇒ **The lesson does not transfer by having been learned once; it has to be EXECUTED every single
time.** Three occurrences in one phase, by three different actors including the lead. **Knowing the
trap is not a control — running the positive control is the control.** Treat any zero, any empty
capture, and any "only one site affected" as unproven until a pattern you know should match has been
shown to match.

⛔ Do NOT re-derive these from migration text — CLAUDE.md's graphify exception is binding
and migration text is stale by design. If you need to re-check something, re-read the
catalog. ⚠ Any `prosrc`/`pg_policies` regex needs a **positive control on a literal you
know is present** before you believe a zero: Postgres ARE spells the word boundary `\y`,
and `\b` is *backspace* — it fails silently and totally (this cost a whole verification
round on 2026-08-25).

---

## 0. The two open [INF] items are CLOSED

**[INF] 1 — `phi/` storage policy shape: NO MIGRATION NEEDED.** The bifurcation is by
**bucket**, not by path prefix (DM5 S3 moved it; the ADR's "phi/ prefix" wording is stale):

| Fact | Value |
| --- | --- |
| `app.printed_rendition_storage_bucket(p_contains_phi)` | `documents-phi` / `documents-standard` |
| `app.printed_rendition_storage_path(p_id)` | `'printed/' \|\| p_id \|\| '.pdf'` — **no kind segment, no branch** |
| Buckets present | `documents-phi`, `documents-standard` (both private, 25 MB cap) |
| `storage.objects` policies | INSERT only, one per bucket, both `app.storage_upload_reserved(bucket, name, uid)` — **kind-agnostic** |
| SELECT policy on either bucket | **none** — downloads go through `/api/documents/[id]` under the service role after `open_printed_document` |

⇒ The case kind inherits the P1 coordinates untouched. "Two dumb policies, not one
conditional one" (0104 D9.4) already holds.

**[INF] 2 — the case module's audited PHI reader:**
`public.get_case_patients(p_case_id uuid) → jsonb` (DEFINER, `authenticated` EXECUTE).
Gated on `app.can_read_case_patient(case, uid)`. Emits `case_patient.read` through
`public.log_audit_access(...)`, entity type `case_patient`, entity id = **the case id**.

⚠ Three shapes the D9 prévia assertion must respect:
- it logs **one row per patient row**, inside the loop — not one per call;
- **unentitled → `null` and NO audit row** (so "no row" ≠ "read happened");
- **entitled but no PHI on file → `[]`** and no audit row either.

`public.get_case_patient` / `get_participant_patient` are the single-row siblings.

---

## 1. Catalog facts you will need

### Print pipeline (all `app.*` are DEFINER; ACLs as noted)

| Function | Signature | ACL |
| --- | --- | --- |
| `app.resolve_print_source_state` | `(kind text, id uuid, OUT o_found, o_status, o_correction_open, o_phase_voided, o_meeting_disposed)` | postgres only |
| `app.print_source_registers` | `(kind text, id uuid) → bool` | postgres only |
| `app.print_source_watermark` | `(kind text, id uuid) → text` | postgres only |
| `app.print_source_series` | `(kind text, id uuid) → uuid` | postgres only |
| `app.print_source_revision` | `(kind text, id uuid) → int` | postgres only |
| `app.print_source_head` | `(kind text, id uuid, rev int default 0) → bool` | postgres only |
| `app.can_view_printed_document` | `(kind text, id uuid, uid uuid) → bool` | + `authenticated` |
| `public.print_source_state` | `(kind, id) → TABLE(status, correction_open, phase_voided, meeting_disposed)` | + `authenticated`, `service_role` |
| `public.mint_printed_document` | `(p_id, p_source_kind, p_source_id, p_template_key, p_template_version, p_content_hash, p_verification_token, p_verification_short_code, p_contains_phi default false, p_source_revision default 0)` | + `authenticated`, `service_role` |
| `public.log_document_previa` | `(kind, id, template_key) → void` | + `authenticated`, `service_role` |
| `public.printed_document_currency` | `(uuid[]) → TABLE(id, is_current)` | + `authenticated`, `service_role` |
| `public.revoke_printed_document` | `(p_id, p_reason_class, p_reason)` | + `authenticated`, `service_role` |

⛔ **CORRECTED 2026-08-25 — the first version of this line was WRONG in the dangerous
direction.** It read *"`app.print_source_*` carry no `authenticated` grant, so if you
DROP+CREATE any of them you inherit that (default = postgres only)"*. The premise is true
and **the conclusion is backwards**: for FUNCTIONS a NULL `proacl` **is** the default and
the default is **`EXECUTE TO PUBLIC`**. `create or replace` preserves an ACL; **`DROP` +
`CREATE` resets it to NULL**, i.e. opens it. `{postgres=X/postgres}` is an *explicit*,
deliberate ACL someone set by revoking PUBLIC — it is not a default you inherit.

Measured in a rolled-back transaction, 2026-08-25 — a freshly created `app.*` function:
`proacl` = **NULL**, `has_function_privilege('authenticated', …)` = **true**,
`has_function_privilege('anon', …)` = **true**. (`anon`, not merely `authenticated`.)
No `pg_default_acl` row covers schema `app`; `authenticated` does hold `USAGE` on it.

⇒ **Every DROP+CREATE in this phase must be followed by an explicit
`revoke execute … from public`**, and a dropped `public.*` door needs the revoke **plus**
`grant execute … to authenticated, service_role` — reproduce both halves of the old ACL,
not just the grant. Verify with `proacl` afterwards, never by assuming.

⛔ **SECOND CORRECTION, 2026-08-25 — "no gate can see this" was FALSE, and the lead accepted it.**
The remedy proposed here (a pgTAP invariant over the `app.*` PUBLIC-executable population, watermarked
rather than allowlisted) **already existed**: `supabase/tests/320_act_expiry_and_acl_hardening.sql`
has asserted it since **2026-08-17**, counting every PUBLIC-executable `app` function, pinning the
total at exactly **237**, with create/drop CONTROLS either side proving the detector moves — and its
header carries the same `proacl = NULL` reasoning, in the same words. A follow-up for the remaining
triage, **`FUP-ACL-APP-POPULATION`**, has existed since the same day.

It caught P3 immediately: the suite measured **249**, the delta being exactly the **12 D15 trigger
functions** that migration `002700` deliberately left alone. Fixed at the cause in `002800` (revoke
the twelve, population back to 237, **320 needed no edit**) rather than by raising the baseline —
raising it would have been bumping a watermark to grandfather what had just been written, the move
`lint:set-local` forbids by name.

⭐ **Two lessons, and the second is the one that generalises.** First: *before building X, grep for X* —
a universal negative ("nothing can see this") has no natural stopping point, so it gets asserted
rather than checked, and it authorised a duplicate. Second, and the reason the trigger functions were
exempted: *"these particular ones are harmless"* is a judgement about danger, but the assertion is a
**POPULATION BOUND**. Repeated, that judgement turns a ratchet back into the hand-maintained allowlist
320's own header says it replaced.

⚠ **Bound the severity honestly, because the overstated version will get quoted.** The
API exposes only `public` and `graphql_public` (`supabase/config.toml` `[api] schemas`),
so `app.*` is **not reachable over PostgREST at any ACL** — the boundary that actually
holds there is schema exposure, and the ACL is defence in depth. This is also not a hazard
P3 introduces: **159 `app.*` DEFINER functions already sit at NULL `proacl` today** (111
of them trigger functions, which are not directly callable at all; **48 callable
helpers**). Do the revokes anyway — consistency with a deliberate explicit ACL is worth
keeping, and `public.print_source_state` **is** exposed.

### Case authorization

| Function | Notes |
| --- | --- |
| `app.can_read_case(case, uid)` | thin projection of `app._case_caps` → `read_case_content` |
| `app.can_read_case_patient(case, uid)` | → `read_standard_phi`. **Zero policy consumers by design** — its consumers are three DEFINER bodies; `patient_identifiers` has no `authenticated` ACL, RLS on, 0 policies |
| `app.has_case_capability(case, uid, cap)` | the chokepoint |
| `app._case_caps(case, uid) → int` | STEP 1 null uid→0 · STEP 2 inactive→0 · STEP 3 unknown case→0 · **STEP 4 hard deny: respondent or recused → 0** · then S1/S2/S3/S5/S6/S7/S8 union |
| `app.is_oversight_only_reader(case, uid)` | `read_case_content AND NOT read_case_deliberation` — the S7 arm and nothing else |
| `app.can_read_case_committee`, `app.can_read_interview`, `app.can_reach_meeting`, `app.can_read_referral`, `app.is_staff_admin_of_for(commission, uid)` | all present, all `(…, p_uid)` explicit-uid forms |

⛔ Always use the **`_for` / explicit-`p_uid`** variant. The bare `app.is_staff_admin_of(...)`
resolves `auth.uid()` and answers about the CALLER, not the subject — ADR 0134 Amendment 6
is a whole record about that exact substitution.

### `cases` lifecycle

- Statuses: `not_started` · `in_review` · `pending` · `completed` · `cancelled`.
- **4 writers of `cases.status`**, all measured: `app.recompute_case_status` (returns early
  under `-- Never override a manual terminal status.`), `close_case` (entry into
  `completed`), `cancel_case` (raises **HC025** on any terminal, so `completed→cancelled`
  is impossible), `reopen_case` (needs `completed`, refuses `cancelled` with **HC0M8**).
- ⇒ **`reopen_case` is the only door out of `completed`.** D3's two-conjunct arm stands.
- `dispose_case_phi(p_case_id, p_reason)` — the disposal door; see finding 5.

---

## 2. Six findings that change the build

### ⭐ Finding 1 — `cases.revision` CANNOT exist. D4's column is unsatisfiable.

`app.guard_case_status` (BEFORE UPDATE on `cases`) raises `check_violation` —
*"cases in a terminal state are immutable (update blocked)"* — on **any non-status update
to a `completed`/`cancelled` case** unless `app.in_case_rpc` is on. D15 needs the counter
to move **exactly while the case is terminal**. A column on `cases` is therefore writable
precisely when it must not move and refused precisely when it must.

⛔ The tempting fix — set `app.in_case_rpc` inside the bump trigger — is rejected: that flag
also unlocks **status transitions** on a frozen case, and switching it on from a trigger
that fires on ordinary content writes would open the freeze for the rest of every such
transaction. It would also route every bump through `audit_cases_trg`, filing a
`case.updated` audit row for a tag rename.

**Resolution (built):** a side table `public.case_print_revisions (case_id pk, revision,
updated_at)`. Absent row == revision 0, matching `meetings.revision`'s default. RLS on, no
policies, `revoke all … from anon, authenticated` (⚠ Supabase default privileges DO grant
`authenticated` ALL on new `public` tables — the revoke is required, not decorative).

### ⭐ Finding 2 — the full-content predicate has SEVEN axes, not one.

D8 named deliberation. The live SELECT policies over the tables the dossier renders carry
six more. Measured:

| Axis | Table | Masking predicate |
| --- | --- | --- |
| A | (all) | `read_case_deliberation` — `is_oversight_only_reader`'s bit shape |
| B | `case_events` | `visibility <> 'case_readers'` needs `is_staff_admin_of` |
| C | `responses` / `answers` | creator ∨ (`submitted` ∧ staff_admin) ∨ correction corridor ∨ targeted. ⭐ **a plain member with `read_case_content` sees the PHASES and none of the ANSWERS** |
| D | `case_interviews` | `app.can_read_interview` (committee reach ∧ confidentiality clearance) |
| E | `action_items` | `assignees_only` / `case_restricted` scopes |
| F | `meeting_cases` | `can_reach_meeting` **per meeting** |
| G | `case_referral` | `app.can_read_referral` (content, not `_metadata`) |

Every **other** dossier table (`case_narratives`, `case_participants`, `case_phases`,
`case_tag_assignments`, `case_correction_requests`) gates on plain `app.can_read_case`, so
the reach conjunct covers them and they get **no axis** — that is a measurement, not an
omission.

⇒ In practice the arm is close to coordinator-only. That is the honest consequence of A7
and D8 already accepted it ("a recused member, or a respondent linked to a single phase,
can neither mint nor download — not even de-identified").

### ⭐ Finding 3 — the `documents` bump trigger MUST exclude `printed_rendition`.

`mint_printed_document` inserts the print's own `public.documents` row homed on the source
— i.e. on the **case** — inside the mint transaction and **after** compare-and-mint has
already passed. A revision bump there advances the counter past the `source_revision` the
same transaction is storing, so **every case mint would land NOT-CURRENT the instant it
succeeded** and `/verificar` would report "não é mais a atual" on paper whose ink is still
wet. Excluded by `kind = 'printed_rendition'` in `app.trg_bump_case_revision_documents`.

### ⚠ Finding 4 — D7's two series per case has no carrier. **LEAD RULING, PO may veto.**

D7 wants two simultaneously-current series keyed `(case_id, variant)`. But:
- `app.print_source_series(kind, id)` takes **no variant**, and `mint_printed_document`
  computes the series before any variant is known;
- `p_contains_phi` is the **wrong axis** — D6 makes it TRUE for *both* variants;
- the one-active index is `printed_documents_one_active (source_kind, source_series_id,
  template_key) WHERE status='active'`, and the door's supersede statement is likewise
  scoped by `template_key`.

⇒ **The index already keys on `template_key`.** So the variant carrier is the template key:
`source_series_id = case_id` for both, `template_key ∈ {'case', 'case_identified'}`. Two
active documents per case, superseding independently, both reporting current
(`printed_document_is_current` reads registers + head, which are variant-independent).

**Zero signature changes** — no DROP+CREATE of `mint_printed_document`, no re-grant, and
the template-coherence check stays **one** site (`p_source_kind = 'case'` ⇒
`p_template_key in ('case','case_identified')`), so the A8 trio stays at three.

This preserves D1: each key is still ONE fixed template with no section picker, and each
gets its own `template-fingerprints.ts` entry — which is *stronger*, since the identified
variant renders a section the other does not. ⚠ It amends **D7's wording** (the key is
`(case_id, template_key)`, not `(case_id, variant)`); ADR 0144 Amendment 1 to be written at
the Record step.

### ⭐ Finding 5 — D10 is ~90% already built, and its real delta is small.

`dispose_case_phi` block (f) **already** does, for `documents.home_resource_id = p_case_id`
— which is exactly where a case's printed renditions are homed:
- `documents.title := '[PHI removido]'`, `description := null`;
- every bound `file_objects` row with `sensitivity_tier='phi'` and `disposal_state='none'`
  → `disposal_state := 'disposal_pending'`, `disposal_reason_category := p_reason`;
- `documents.status := 'disposal_pending'` where a PHI-tier file is bound.

Byte destruction completes asynchronously in `complete_document_disposal`. And
`app.resolve_document_version_bytes` already raises on `disposal_pending`/`disposed`, so
the download is shut in the same transaction.

⇒ **D10's remaining delta is only the registry rows**: mark the case's `printed_documents`
rows revoked with a disposal `revoked_reason_class`.
⚠ `revoked_reason_class` has **no table CHECK** — the vocabulary
(`wrong_data` / `minted_in_error` / `other`) lives *inside* `revoke_printed_document` only.
So a new class `phi_disposed` can be written by `dispose_case_phi` **without** widening the
human-facing revoke door's list, and it must not be added there (a human must not be able
to claim an Art. 18 erasure). `src/components/printing/labels.ts` needs its pt-BR label.
⚠ `pd_revocation_complete` CHECK: `revoked_at` non-null ⇒ `revoked_reason_class`,
`revoked_reason` and `revoked_by` all non-null. `pd_revoked_iff_ts`: `status='revoked'` ⇔
`revoked_at is not null`.

### ⭐ Finding 6 — the download half of D8 is already enforced, for free.

`app.resolve_document_version_bytes` (QO·B P0-1) already refuses **case-homed BYTES**
unless `app.has_case_capability(case, uid, 'read_case_deliberation')`, and
`open_printed_document` delegates byte resolution to it. So the moment case prints exist,
axis A is enforced on download by shipped code. The new `can_view_printed_document` case
arm is what closes the **mint** side and reinforces the rest.

---

## 3. Already written by the lead (syntax-checked in a rolled-back transaction)

- `supabase/migrations/20261003002200_case_print_revision_substrate.sql` — the counter,
  `app.case_is_terminal`, `app.bump_case_print_revision`, and the D15 trigger set over 19
  dossier-visible tables incl. the 5 commission-vocabulary ones. **`backend` owns it from
  here** — extend/correct freely, it is not sacred.
- `supabase/migrations/20261003002300_can_read_full_case_content.sql` — the seven-axis
  fail-closed predicate + the `COMMENT ON FUNCTION` debt ADR 0104 owed the meeting twin.

⚠ Neither has been applied to a real DB — they were checked with `begin; \i …; rollback;`
only. A fresh `supabase db reset` is still required.

---

## Authz arms — scope, and the substitution trap (added 2026-08-25, gate step 1 OUTSTANDING)

⛔ **None of the four ADR 0079 arms was run this phase, nor the diff-scoped door sweep.**
`ARM=census`, `ARM=hat`, `ARM=floor`, `FROMFINDINGS=1 ARM=wrapper` — all outstanding.
`supabase/tests/mutation/p0-authz-invariant.sh` was never invoked; corroborated by the absence of
any artifact under `supabase/tests/mutation/` timestamped inside the build window.

### ⛔ The trap: a mutation audit is NOT an arm

A mutation audit **was** run this phase and reported at length — four neutralize → RED → restore
cycles over `368`'s absence assertions. **It must never be quoted as arm coverage.**

| | asks | domain |
| --- | --- | --- |
| the `368` audit | *"can MY new tests fail?"* | this phase's assertions |
| `ARM=census` | *"has anything EVER asked?"* | every DEFINER gate in the schema |
| `ARM=policy` (diff-scoped) | *"does anything NOTICE when a gate is opened?"* | the gates in the diff |
| `ARM=floor` | *"is every door CALLED?"* | every door |
| `ARM=hat` | *"does any door read `memberships` without the caller's hat?"* | every door |

⭐ Different subject, different domain, different failure mode. Four greens on the first row say
nothing about any of the other four. This is CLAUDE.md §6 step 5's *"name the ARM, never the
script"* arriving **from the other direction** — a genuinely different audit that reads as coverage
because it shares the word *mutation*. Had the row said *"mutation audit passed"* it would have been
**true and completely misleading**.

### Scope

⭐ **Zero RLS policies touched** — verified over the seven-migration diff: `create|alter|drop
policy` = **0**; the only 4 occurrences of the word `policy` are in comments; no dynamic DDL
creates one (`execute`/`format` lines containing `create … function` = 0); `create function`
without `or replace` = **0**, so both DROP+CREATEs sit inside the 27 below. ⇒ **the sweep's policy
half is empty and the whole sweep is `prosecdef` gates.**

**27 gates created or replaced; 17 brand new:**

- `app.` — `case_is_terminal` · `bump_case_print_revision` · `can_read_full_case_content` ·
  `can_view_printed_document` · `resolve_print_source_state` ·
  `print_source_{registers,watermark,series,revision,head}` · the **12** `trg_bump_case_revision*`
- `public.` — `print_source_state` · `mint_printed_document` · `log_document_previa` ·
  `open_printed_document` · `dispose_case_phi`

⚠ **`ARM=census` is the load-bearing arm here.** A brand-new gate is in **no BLIND set**, so it
passes `ARM=policy` **vacuously** (ADR 0079 Amdt 3). With 17 of 27 brand new, this phase is close
to the worst case that argument was written for.

⚠ **Two are DROP+CREATE, not `create or replace`** — `app.resolve_print_source_state` and
`public.print_source_state`. A rebuilt function is the documented way an ACL silently reverts.
pgTAP `368` t1–t4 pin them, but ⛔ **a pgTAP pin is not an arm verdict.**

### ⛔ The list above is a CANDIDATE list, not the scope

⭐ **TWO RULES THAT ANSWER DIFFERENT QUESTIONS, and collapsing them fails in both directions:**

- **ADR 0079 Amdt 1 — *"derive from the diff, never by hand."*** The diff tells you what the phase
  **intended to touch**. That is the right input for **scoping** a sweep, and dropping it is how a
  sweep gets hand-listed and under-covers.
- **CLAUDE.md's binding exception — *"migration text is STALE by design."*** The catalog tells you
  what **is**. That is the only valid input for a **claim about gates**.

⛔ Read as one rule, you either take a security scope off text (what happened here) **or** discard
the diff that legitimately bounds the sweep. The list above is the *first* rule's output and must
be finished by the second.

**Why the hazard is live in this diff specifically:** these migrations rewrite bodies at runtime via
`pg_get_functiondef()` + `replace()` + `execute`, and the diff carries **49** `execute`/`format`
lines. `002400`'s own header already warns that a DROP+CREATE leaves a NULL `proacl` behind — the
mechanism was in hand and the text was still read as scope.

**Reconciliation on the fresh tree, BEFORE any arm** — `pg_proc.prosecdef` + `proacl`, plus
`pg_policies`/`pg_policy` to re-confirm the zero-policy claim **against the catalog** rather than
against the diff that produced it. Both directions, neither is bookkeeping:

| mismatch | what it means |
| --- | --- |
| **in the list, absent from the catalog** | a migration statement that did not take effect, or a name that never existed — the shape where a phase believes it shipped a gate it did not |
| **in the catalog, absent from the list** | ⛔ **worse** — a gate created by a runtime rewrite the diff cannot show. Nobody scoped it, so nothing would have swept it |

⭐ **Report the reconciliation BEFORE the verdicts.** An arm verdict is only as good as the domain
it ran over, and a green over an under-scoped set is precisely the vacuity the arms exist to
prevent. *"PASS"* without its set is the same class of statement as naming the script instead of
the ARM.

### Sequencing

⛔ The arms mutate the local DB. They run **only** on a fresh `supabase db reset --local`, after
`tester` releases the stack, and **before** `qa` is spawned. `ARM=floor` reads **35** unallowlisted
doors on a stale DB and **0** on a fresh reset — never quote it without one.
