# DSR Slice 4 — QA review

**Verdict: `CHANGES REQUESTED`**

**⭐ The central claim SURVIVES.** I attacked all three legs of the lead's Slice 4 item‑1
withdrawal independently from the live catalog and could not break any of them. The residue
class named by `FUP-NOTIFICATIONS-PHI-RESIDUE` does not exist, and withdrawing item 1 was the
correct call. **Leg 1 is in fact stronger than the lead proved it** (below).

The changes requested are **records and copy corrections, not a rebuild**. They are itemised
because two of them are the exact failure classes this program has already had to correct twice:
a security sentence written into an accepted ADR that is **false as stated**, and an open
obligation whose **designated fix vehicle shipped without it**.

---

## 1 · Method

Everything below was measured from the live catalog (`pg_proc` / `pg_get_functiondef`,
`pg_constraint`, `pg_policies`, `pg_class.relacl`, **`pg_attribute.attacl`**, `pg_inherits`,
`pg_rules`, `pg_trigger`) on `supabase_db_azkbbhskturikxpgmafq`. No migration file text was
read or believed (CLAUDE.md graphify exception). All write probes ran inside a transaction and
were rolled back; no data was mutated.

I re-derived the notification title/body census **from scratch** by reading all sixteen caller
bodies in full, rather than checking the lead's list — so the agreement below is a reproduction,
not a confirmation.

---

## 2 · The claim under attack — leg by leg

### L1 — `entity_type`'s CHECK makes the predicate vacuous for 3 of 4 doors → **UPHELD, and stronger than claimed**

```
notifications_entity_type_check | contype=c | convalidated=t
CHECK (entity_type = ANY (ARRAY['capa_action','response_section_signoff','meeting',
  'action_item','ethics_notification','commission','controlled_document',
  'controlled_document_version']))
```

`case`, `referral`, `event` are absent. Confirmed additionally: `relkind='r'` (not partitioned),
`pg_inherits` count **0** (no inheritance child could carry a looser CHECK), **no rules**, **no
triggers** on `notifications`, and `convalidated = t` (not `NOT VALID`).

**Where the lead's proof was weaker than it needed to be.** The lead proved L1 by attempting
inserts of `'case'`/`'referral'` and observing refusal, with a `'meeting'` positive control.
That is a *role- and path-scoped* proof — it shows the CHECK is enforced for the probing session,
which is exactly the objection raised against it. I closed that gap by constructing the
adversarial state: the insert is refused **as superuser, under
`session_replication_role = replica`** — the standard constraint-bypass that does disable FK/RI
and triggers — with a `'meeting'` positive control accepted in the same block proving the probe
was live:

```
NOTICE:  ENTITY_TYPE=case UNDER replica + SUPERUSER: REFUSED (check enforced)
NOTICE:  POSITIVE CONTROL entity_type=meeting: ACCEPTED (probe can succeed)
```

A CHECK constraint is enforced for every role on every INSERT/UPDATE path including `COPY` and
`service_role`; the only bypass is DDL (`ALTER TABLE … DROP CONSTRAINT`), which requires table
ownership. **L1 holds by construction, not by convention.**

⚠ Note the live table holds **2 rows** (both `response_section_signoff`). Any data-level probe
here proves close to nothing; L1 rests on structure, which is the right place for it.

### L2 — one writer, sixteen callers, none reads `cases.label` → **UPHELD; one supporting sentence is FALSE**

The writer enumeration is correct **and is bounded by the property, not by a grep string**. I
searched every `public`/`app` function whose definition mentions `notifications` for *any* write
syntax — `INSERT`, **`MERGE INTO`**, **`COPY`**, and any body containing `EXECUTE` (dynamic SQL).
Result: 21 functions mention the table; **exactly one writes it** —
`app.enqueue_notification/10` (`prosecdef = t`) — and no function combines dynamic execution with
the table. Cross-checked against `pg_rules` (none) and `pg_trigger` (none). There is no second
writer.

Sixteen callers, matching the lead's count exactly. **None reads `cases.label`.** None reads
`case_referral.subject` either — which matters, because that is the other column an erasure door
redacts.

**⛔ FINDING R1 — the ACL sentence is false.** Amendment 4 leg 2, and its two follow-up copies,
state the writer set is *"bounded, not merely enumerated"* because `notifications`
*"grants `authenticated` `r` alone."* That is wrong. There is a **column-level UPDATE grant**:

```
pg_class.relacl      : authenticated=r/postgres
pg_attribute.attacl  : read_at = authenticated=w/postgres     <-- not in the table ACL
```

`authenticated` therefore **can** UPDATE `notifications` (this is how the INVOKER function
`public.mark_notification_read/1`, `prosecdef = f`, works at all). Constructed and rolled back:

```
NOTICE:  TITLE-UPDATE:   DENIED (permission denied for table notifications)
NOTICE:  READ_AT-UPDATE: ALLOWED at grant layer
```

**The conclusion survives** — the grant is scoped to `read_at`, so `title`/`body` remain
unwritable by `authenticated`, and I have now proven that by construction rather than by reading
an ACL. But the *stated reason* is false, and it is stated as the justification for a negative
security claim in an **Accepted** ADR. This is the project's own standing lesson — a table-level
ACL census is not bounded by the property; column grants are a live mechanism in this codebase.
A future session reading "authenticated holds `r` alone" will conclude `notifications` is
read-only to clients and be wrong.

### L3 — no notification title/body source is erased by any door → **UPHELD**

My independent census of all sixteen callers. Every non-literal title/body expression:

| Source column | Callers | `entity_type` |
| --- | --- | --- |
| `capa_action.title` | `add_capa_action`, `update_capa_action`, `compute_due_notifications` | `capa_action` |
| `meetings.title` | `add_meeting_attendee`, `seed_expected_…`, `seed_selected_…`, `complete_minutes_job`, `fail_minutes_job`, `compute_due_notifications` | `meeting` |
| `commissions.name` | `app.compute_due_charter_notifications` | `commission` |
| `controlled_documents.title` / `.code` | `publish_document`, `remind_document_approver`, `submit_document_for_approval`, `app.decide_document_approval_core`, `app.compute_due_document_review_notifications` | `controlled_document(_version)` |
| `ethics_notifications.notification_type` | `app.compute_due_ethics_notifications` | `ethics_notification` |
| `action_items.title` | `compute_due_notifications` | `action_item` |
| `form_sections.title` | `save_section_answers` | `response_section_signoff` |

This reproduces the lead's list **exactly** — eight sources, no more. The `ethics_notification`
body is verified PHI-free by construction: `ethics_notifications.notification_type` carries its
own CHECK over eight fixed values.

**The "helper one frame away" attack fails.** I checked every title/body argument position for an
interpolated function return. There are none: each is a string literal, a `||` concatenation of
literals with a locally-selected column variable, a record field computed as a `CASE` over
literals (`r.heading`), or `coalesce(...)`. No helper's return value reaches title or body, so
reading the call sites was — in this instance — sufficient.

**Cross-reference against the four door bodies (read in full, not grepped):** zero overlap.
No door touches `capa_action.title`, `meetings.title`, `commissions.name`,
`controlled_documents.*`, `ethics_notifications.notification_type`, `action_items.title`, or
`form_sections.title`. Note in particular that `dispose_event_phi` erases
`capa_action_task.description` (the grandchild) and not `capa_action.title` — a different table,
correctly distinguished in the records.

### The strongest available counter-argument, and why it also fails

L1 proves *the specified predicate matches zero rows*. It does **not**, on its own, prove *no
residue exists* — a notification could carry an erased string while being filed under a different
`entity_type`, in which case the residue would be real **and** the proposed fix would not even
have found it. This distinction matters and the records do not draw it.

I tested it and it comes out clean: the only columns any door erases that could plausibly reach a
notification are `cases.label` and `case_referral.subject`, and **no writer reads either**. So the
conclusion "unnecessary" is true, not merely "not constructible as specified."

**Worth carrying forward (documentation, not a defect):** the records correctly flag that
`compute_due_ethics_notifications` stores a `cases.id` under `entity_type='ethics_notification'`
(verified — lines pass `r.case_id`, not the notification id, in all three arms). That row **is**
reachable by a case UUID. Its title/body are a literal and a CHECK-enum, so there is no residue —
but any future `(entity_type, entity_id)` predicate over this table will key those rows wrongly.
This is the single most useful thing the slice discovered and it deserves to survive as more than
a rhetorical flourish in an amendment.

---

## 3 · Blocking items

**B1 — Correct the false ACL sentence in three records.**
ADR 0130 Amendment 4 leg 2, `docs/progress/follow-ups.md` (the `⬛ FUP-NOTIFICATIONS-PHI-RESIDUE`
closure block), and `docs/progress/follow-ups-archive.md` all assert `notifications`
*"grants `authenticated` `r` alone."* Measured: table ACL `authenticated=r`, **plus a
column-level `read_at = authenticated=w`**. Restate as what is actually true and load-bearing:
*`authenticated` holds table-level SELECT plus a column-scoped UPDATE on `read_at` only; a
`title`/`body` write is refused at the grant layer* (constructed above). Violates the standing
`prosecdef`/ACL-census discipline (CLAUDE.md §3 Rule 1; ADR 0079) and Phase Gate §6 step 5's
requirement that a gate record not claim more than was measured.

**B2 — `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT` is stranded on a shipped vehicle.**
It is still 🟠 **open** in both `PROGRESS.md:400` and `docs/progress/follow-ups.md:4544`, and both
name **"fix vehicle: DSR plan Slice 4 (residue + copy honesty)"** with the clause *"either redact
them or name them as retained; **the one unacceptable state is the current one**."* Slice 4 has
now shipped and the program is declared **complete with no Slice 5** — and the current state is
what shipped. Neither branch of that instruction was taken and the vehicle was not re-pointed.

Confirmed against the catalog: `meeting_agenda_items` has four text columns
(`title`, `description`, `discussion_notes`, `resolution`) and `dispose_meeting_minutes`
redacts three — **`title` survives**. This is not hypothetical: `dispose_case_phi` redacts
`case_events.title`, so the codebase already treats a `title` column as PHI-bearing elsewhere.

This has a **shipped-copy consequence**, which puts it inside Slice 4's own remit rather than
beside it. `DSR_RESIDUE_NOTICE` line 1 reads *"O descarte apaga os dados do paciente armazenados
no banco para este registro"* — for the meetings door that is false while an agenda item can be
titled with a patient's name. The new `FUP-DOOR-ERASURE-FREETEXT-CENSUS` **acknowledges exactly
this** ("a confirmed under-erasure makes `DSR_RESIDUE_NOTICE`'s first line an over-claim") yet
the slice shipped that line and closed out. Required: either re-point
`FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT` at a named successor vehicle **and** record the deferral
decision, or absorb it into `FUP-DOOR-ERASURE-FREETEXT-CENSUS` explicitly by name. An open item
pointing at a completed vehicle is invisible.

---

## 4 · Non-blocking findings

**N1 — The repo-wide grep prohibition is violated by the slice's own file, and the two records
disagree about its scope.**
`src/components/dsr/dsr-meeting-dispose-dialog.tsx` states the detector is *"a grep over `src/`"*
and *"The prohibition is **repo-wide**, not file-local."* Under that scope it does not hold:

```
src/lib/dsr/messages.ts:72:  * `FUP-DISPOSE-DIALOG-OVERCLAIM` (the shipped "apaga permanentemente … todos os
```

Meanwhile `follow-ups.md` and the archive state the rule file-locally (*"nothing in **that file**,
comments included"*) and record a **file-scoped** grep as the closure evidence — which does pass.
So the closure is verified under one stated scope and fails under the other. Pick one: either
narrow the dialog's comment to file-local, or clear the quotation from `messages.ts:72`. As
written, the next person to run the check described in the meeting dialog will get a hit and read
it as an unfixed defect — precisely the trap the slice congratulates itself on avoiding.

**N2 — The confirm-field helper is a mild over-claim; the button is fine.** (Verdict requested.)
- **`"Apagar definitivamente"` (button) — acceptable.** A destructive button states the finality
  of the *action*. It sits directly beneath the verbatim residue notice, and the plan's point
  about re-scoping E2E locators is a legitimate cost against a marginal gain.
- **`"Confirmação exigida por se tratar de exclusão definitiva de dados pessoais."` (helper) —
  narrow it.** This one is not merely finality. It drops the scope the rest of the dialog is
  careful to keep (*"Apaga **do banco de dados** … o conteúdo sensível"*) and asserts
  definitiveness over the unqualified noun **"dados pessoais"** — which `DSR_RESIDUE_NOTICE`
  lines 2 and 3 directly contradict (attachments retained encrypted for 20 years; PITR retains
  the content for days). That is a completeness claim over a category, which is the ADR 0056 (b)
  class. Suggested: *"Confirmação exigida porque o descarte não pode ser desfeito pela
  plataforma."* Non-blocking only because the authoritative notice renders two blocks above it in
  the same dialog.

**N3 — `FUP-DOOR-ERASURE-FREETEXT-CENSUS` is correctly aimed but under-specified.**
It states the right principle — *"Bound by the property, never by a door's own body — what is
missing from it is the finding"* — which is exactly the correction the program needed. But it
names no **enumerator** that would produce the complete set, so it currently reads as a list of
four remembered instances. To be bounded by the property it needs the mechanism stated: for each
door's subject table, the transitive FK closure of tables on that PHI lane, then every free-text
column on those tables, minus the door's measured erasure set. Without that it repeats the
original error one level up — a list of columns someone could think of is not an enumeration. It
also fails to absorb its overlapping sibling's already-measured instances
(`meeting_attendees.{note,external_name}`, `meeting_closed_sessions.label`) — see **B2**.

---

## 5 · Code review — `src/components/referrals/referral-dispose-dialog.tsx`

**Passes.** Verified against the requirement clauses:

- **Both ADR 0056 (b) over-claims replaced, not supplemented.** The section paragraph and the
  `AlertDialogDescription` are rewritten; `permanentemente` / `todos os campos` /
  `Não é possível desfazer` are gone from the file (not qualified in place). ✅
- **`DSR_RESIDUE_NOTICE` rendered verbatim, no fifth line, no paraphrase.** Imported from
  `@/lib/dsr/messages` and mapped directly; all four lines, unmodified. Matches the treatment in
  `dsr-meeting-dispose-dialog.tsx` and `dsr-task-inbox.tsx`, and the outcome record draws the same
  constant via `src/lib/queries/dsr.ts:502`. ✅
- **Rule 10 (pt-BR).** All user-facing strings pt-BR; comments and identifiers English. ✅
- **Accessibility of the conditional `subject_request` note.** Correct — and this is the detail
  most often got wrong. `aria-describedby` is set to `` `${reasonId}-dsr` `` **only when the note
  is actually rendered**, and `undefined` otherwise, so there is no dangling IDREF pointing at an
  unmounted node. The confirm input's `aria-describedby` targets a permanently-rendered helper.
  Labels are associated via `htmlFor`, the error uses `role="alert"`, and the dialog is fully
  keyboard-operable through the shadcn `AlertDialog` primitive. ✅
- **Server/client boundary.** The dialog imports a constant (not a query module) from
  `@/lib/dsr/messages`; `lint:client-server-imports` is green. ✅

**Scope check.** The plan's item 2 claims *"`disposeCasePhi`/`disposeEventPhi` have no UI caller
at all. Re-measured in S4 and unchanged."* That is now **stale** — `src/lib/dsr/actions.ts:102,105`
calls both, reached from `dsr-task-inbox.tsx`. The stated *conclusion* is nonetheless satisfied,
and by a better route than the plan claims: the inbox renders `DSR_RESIDUE_NOTICE` at the
disposal confirmation point (`dsr-task-inbox.tsx:374`), so every disposal surface does carry the
notice. Fix the sentence, not the code.

**Gates.** `npm run lint` — all eight gates green (eslint 0/0, css-vars, memberships-door,
client-server-imports, vacuous 202 specs/0 findings, set-local, progress, rules).

---

## 6 · Could not verify — a work item, not coverage

- **Whether `meeting_agenda_items.title` / `meetings.title` / `action_items.title` actually
  receive PHI in practice.** I established they are free text and un-erased; whether operators
  put patient names there is a usage question no catalog probe answers. It is the premise of
  **B2** and of `FUP-DOOR-ERASURE-FREETEXT-CENSUS`, and it is currently assumed rather than
  measured on both sides.
- **The completeness of `FUP-DOOR-ERASURE-FREETEXT-CENSUS`'s eventual scope.** I did not run the
  full four-door transitive-FK free-text census — that is the follow-up's own body of work, not
  this review's. I verified only the one instance the records cite
  (`capa_plan.source_event_id` → `patient_safety_event` FK confirmed; `capa_action.title` is
  `text not null`; erased by no door).
- **E2E behaviour of the rewritten dialog.** I am read-only and did not run Playwright; the
  tester's green is the authority for step 2. Note the standing baseline: `e2e:prod` is currently
  RED for two pre-existing `quality-oversight` failures unrelated to this slice.

---

## 7 · Summary

| Item | Verdict |
| --- | --- |
| **L1** — CHECK makes the predicate vacuous for 3/4 doors | ✅ **Upheld**, strengthened to superuser + replica-mode |
| **L2** — one writer, 16 callers, none reads `cases.label` | ✅ **Upheld**; ⛔ its ACL justification is **false** (B1) |
| **L3** — no notification text source is erased by any door | ✅ **Upheld**, census independently reproduced |
| Withdrawing Slice 4 item 1 | ✅ **Correct call** |
| Dialog code (copy, Rule 10, a11y, verbatim constant) | ✅ Passes |
| Records accuracy | ⛔ B1 (false ACL claim), N1 (contradictory grep scope), scope sentence stale |
| Open-obligation hygiene | ⛔ B2 (stranded FUP on a completed vehicle) |

**B1 and B2 are both one-edit fixes to records.** No code change is required beyond the optional
N2 helper-string narrowing. Once B1 and B2 land, this is an `APPROVED`.

The thing this slice got most right is worth naming: it measured a premise before building on it,
found the premise false, and recorded the falsification rather than dropping the item quietly.
The two blocking items are the residue of that same discipline not being applied to the *record
of the measurement* — a sentence about an ACL that was read rather than constructed, and an
obligation whose vehicle closed underneath it.

---

# DSR Slice 4 — QA review, round 2

**Verdict: `CHANGES REQUESTED`**

**⭐ The widening itself is correct, and it is the strongest piece of engineering in this
program so far.** I re-derived the composition closure from the live catalog without reading
the migration's list, and it reproduces the build's nine tables exactly — including the two
near-misses (depth-2 `meeting_closed_session_items`, and the two **jsonb** minutes columns).
I hunted for the *third* blind spot the task asked about and there is none: no arrays, no
domain-over-text, no `hstore`, no generated columns, no `xml`, no partitions and no
inheritance children anywhere on the closure. The guard change is bounded, the transcript
purge is right, and both retention arms are non-vacuous.

**What blocks is not the door.** Two items, both in the *verification* layer, both instances
of the exact class this slice was convened to close: a closure record whose stated evidence is
**measurably false at the moment it was written**, and a pin in the new pgTAP suite that
**passes on an empty population**, proven by construction below.

---

## r2 · 1 — Method

All schema, ACL, policy, trigger and function facts below were measured from the live catalog
on `supabase_db_azkbbhskturikxpgmafq` (`pg_proc` incl. `prosecdef`/`proacl`/`prosrc`,
`pg_constraint`, `pg_attribute.attacl`, `pg_class.relacl`, `pg_policy`, `pg_trigger`,
`pg_inherits`, `pg_auth_members`). No migration file text was believed; where a migration is
cited it is only to establish *what changed*, and the live body was read separately.

**Rollback proven before any probe, in both directions.** Baseline
`count||md5(string_agg(...))` over `public.meetings` taken before and after every run:
`3|c2ab16ad58a352e07d933137fbb0abfe` both times. I installed `pgtap` (absent from this
database — `supabase test db` provisions it per run) in order to execute suite `351` directly,
and **dropped it again**; `select count(*) from pg_extension where extname='pgtap'` → `0`,
hash re-verified unchanged. The stack is left exactly as I found it.

Suite `351` executed live: **32/32 `ok`**. `npm run lint:vacuous` → OK (205 spec files, 0
findings, 42/42 self-test). The three new Vitest files → 3 passed / 32 tests.

---

## r2 · 2 — Part 1: my r1 findings

### B1 — false ACL claim → **CLOSED, and the replacement claim verified independently**

Corrected in all three places (ADR 0130 Amdt 4 `:275-284`, `docs/progress/follow-ups.md:4433-4438`,
`docs/progress/follow-ups-archive.md:2266-2269`). I did not merely check the old sentence was
gone; I measured the **new** one, which asserts *"no INSERT privilege … to `authenticated` at
any grain"*:

```
pg_class.relacl        : authenticated=r/postgres                    -- no 'a'
pg_attribute.attacl    : read_at ONLY  -> {authenticated=w/postgres} -- every other column: none
has_table_privilege('authenticated','notifications','INSERT')        -> f
bool_or(has_column_privilege(...,'INSERT')) over all 14 columns      -> f
pg_auth_members where member = 'authenticated'                       -> 0 rows (no inherited grant)
pg_policy on notifications : notifications_select_own (SELECT),
                             notifications_update_own (UPDATE)       -- no INSERT policy
```

Both grains checked, plus the role-inheritance path a two-grain census would still miss. The
claim holds. The `read_at` column grant is named explicitly, which was the point of B1. ✅

*Wording nit, not a finding:* "grantable" reads as "cannot be granted", which is false — the
owner may grant it at any time. The measured fact is "**granted** to `authenticated` at no grain".

### B2 — stranded follow-up → **CLOSED by building the fix.** See §3.

### N1 — grep scope → ⛔ **NOT CLOSED. See B3 — the defect is live again.**

### The plan's stale `disposeCasePhi`/`disposeEventPhi` sentence → **CLOSED**

`docs/plans/dsr-workflow-plan.md:278-287` now carries the correction *and* the reason the first
measurement was wrong (its boundary was `src/components/` + `src/app/`, missing
`src/lib/dsr/actions.ts`), plus the separate "two dialogs vs four render sites" distinction.
Better than what I asked for. ✅

---

## r2 · 3 — Part 2: attacking the widening

### 3.1 · Is the column set complete? — ⭐ **YES. Re-derived from the catalog; exact match.**

I built the closure recursively from `pg_constraint` using the build's own separator
(`confdeltype = 'c'` **and** `bool_and(attnotnull)` over every column of `conkey`), anchored on
`public.meetings`:

| depth | table |
| --- | --- |
| 0 | `meetings` |
| 1 | `meeting_agenda_items`, `meeting_attendees`, `meeting_cases`, `meeting_closed_sessions`, `meeting_minutes_jobs`, `meeting_signatures` |
| 2 | `meeting_closed_session_items` |
| 3 | `meeting_closed_session_item_readers` |

Nine tables — the build's number, reproduced rather than confirmed. **Depth 3 is real, and the
build's prose only ever says "depth-2"**; `meeting_closed_session_item_readers` is in the
closure and carries **no text column at all** (`id`, `item_id`, `user_id`, `created_at`), so
nothing is owed there. ADR 0056 Amdt 1 states that; I verified it.

The rejected near-misses are exactly right, and the reason is a catalog fact in every case:

```
action_items.source_meeting_id       CASCADE  but NULLABLE   -- provenance, not composition
action_items.source_agenda_item_id   SET NULL
capa_plan.source_meeting_id          RESTRICT
rca_evidence.cited_meeting_id        RESTRICT
case_votes.meeting_id                SET NULL
ethics_hearings.meeting_id           SET NULL
meeting_cases.agenda_item_id         SET NULL
```

**The third blind spot the task asked me to look for does not exist here.** I enumerated all
**113** columns on the nine tables with `typtype`, `typcategory`, `typbasetype`, `typelem` and
`attgenerated`, precisely so the boundary would not be a type list again:

- `typcategory = 'A'` (arrays, incl. `text[]`): **0**
- `typtype = 'd'` (domain over text): **0**
- `hstore` / `xml` / `json` (as distinct from `jsonb`): **0** — `hstore` is not even installed
- `attgenerated <> ''` (generated columns): **0**
- `pg_inherits` children / `relkind = 'p'` on any closure table: **0** — no partition could
  carry a column the parent census cannot see

Every free-text-capable column on the closure is therefore either redacted or classified. The
full ledger is in §4.

### 3.2 · The guard change — **bounded, and the amendment's reasoning is sound, not circular**

**One setter, two readers, verified from `prosrc` across the whole of `pg_proc`** — not a grep
of two files:

```
app.guard_meeting_child_lock    prosecdef=t   reader=t   setter=f
app.guard_reserved_child_lock   prosecdef=t   reader=t   setter=f
public.dispose_meeting_minutes  prosecdef=t   reader=f   setter=t
```

…and **exactly** those three functions mention `in_disposal` anywhere in the catalog.

The delta to `app.guard_reserved_child_lock` is **three lines and nothing else**. A
comment-stripped diff of the old definition against the new yields the stand-aside branch
alone; `security definer`, the `search_path` pin, the cascade-null branches and the
locked-status set are unchanged.

**Can a non-disposal path now reach the reserved child tables?** No — and I attacked the one
route that would make the setter-count argument hollow, a caller setting the GUC itself:

- No function in `app` or `public` calls `set_config` with a **non-literal** first argument
  (regex `set_config\s*\(\s*[^']` → **0 rows**), so no door can be induced into setting an
  arbitrary GUC.
- `set_config` itself lives in `pg_catalog`, which PostgREST does not expose, so no client can
  reach it over the API surface at all.
- ACL unchanged by the rewrite and verified live: `dispose_meeting_minutes` →
  `{postgres=X, service_role=X, authenticated=X}`, `has_function_privilege('anon', …)` → **f**.
  `CREATE OR REPLACE` preserved it, and shipping **no** `revoke/grant` idiom was the right call
  — the house idiom would have been an over-grant here.

**ADR 0129 Amendment 1 does not merely assert the invariant it needs.** It identifies the right
quantity: the bypass is exercised only while the flag is `'on'`, so the **setter** count bounds
it and the reader count never did. That is a mechanism, not a restatement — and it is pinned in
both directions (`351` t8 red if the stand-aside is removed, t32 red if it is widened to
`app.in_meeting_rpc`; t31 additionally proves the flag did not survive past the door into the
rest of the transaction, which I confirmed by running the suite). The rejected shape stays
rejected. ✅

*Observation, inert:* both guards carry `proacl = NULL` (⇒ PUBLIC EXECUTE). This predates the
change and is unexploitable — a plpgsql trigger function raises when called directly, and
schema `app` is not PostgREST-exposed — but it is the shape of
`guards-that-read-right-but-fail-open`, and deserves one line in `docs/backend-state.md`
rather than being rediscovered a fifth time.

### 3.3 · The transcript purge — **correct, and no other column carries transcript-derived text**

Read from the **live** `pg_get_functiondef`, not the file:

```sql
update public.meeting_minutes_jobs
   set transcript = null, draft = null, result = null,
       purged_at  = coalesce(purged_at, now())
 where meeting_id = p_meeting_id
   and (transcript is not null or draft is not null or result is not null);
```

Set-based over `meeting_id`; **no `limit 1`**, no `order by`, and no correlated single-row
select anywhere in the door. I confirmed independently that there is **no** unique constraint
and no unique index on `meeting_minutes_jobs.meeting_id`, so the warning is a real one and the
shape is right.

**Other columns of `meeting_minutes_jobs`:** `audio_path`, `audio_deleted_at`, `service_job_id`,
`error_code`, `error_message` survive. I traced the writers rather than trusting the names. The
only one that could plausibly carry model output is `error_message`, written solely by
`public.fail_minutes_job(uuid,text,text)`, and two facts close it: the same statement that
writes `error_message` **also nulls `transcript`/`draft`/`result` and stamps `purged_at`**, and
`fail_minutes_job` early-returns unless `status in ('uploading','processing')` — so a job that
ever reached `done` (the state this finding is about) can never acquire an `error_message` at
all. Nothing else on the table is transcript-derived. ✅

**The finding behind it is the real one and the record states it correctly:** of
`audio_job_status`' six values only three purge, and `done` — the ordinary resting state — is
not one of them. Nulling unconditionally rather than by a status predicate is the right call,
for the reason given (a transition-graph predicate goes stale on the next state added).

### 3.4 · pgTAP 351 — the fixture IS locked; ⛔ **a second vacuous pin exists (t25)**

**The lock is real, and I checked it the way it can actually fail.** t1 asserts
`status = 'in_signature'` and passed on a live run; independently, both
`app.guard_meeting_child_lock` and `app.guard_reserved_child_lock` fire on exactly
`{in_signature, signed, distributed, cancelled}` per their live bodies, and `pg_trigger`
confirms all four written tables carry one of them
(`meeting_agenda_items` / `meeting_attendees` / `meeting_closed_sessions` → child lock;
`meeting_closed_session_items` → reserved lock). A `scheduled` fixture would indeed have shown
green over a broken door; this one does not. ✅

⛔ **t25 is the second pin of the t22 shape, and I proved it by construction rather than by
reading it.** The suite's own header sets the rule (`351:31`): *"Each pin asserts a count of
offending rows is zero; each has a t1-t7 control proving the population is non-empty. Either
half alone is satisfiable by an empty table."* **t25 has no such control.** It is also the only
pin in the file whose fixture insert is **conditional** (`351:143-146`) — it joins
`public.cases`, so if the anchored commission has no case the insert matches zero rows and t25
asserts nothing.

Differential run, `where false` added to that one insert and nothing else changed:

```
ok 25 - t25 ⭐ meeting_cases.{summary,decision} are NOT touched by the meeting door …
```

**32/32 still green with the population empty.** This is exactly t22's original defect: a pin
that cannot be falsified. It matters because ADR 0056 Amdt 1 cites it twice as the guarantee —
*"Pinned by `351` t25 so that widening it later is a decision someone makes rather than a side
effect"* — and today that guarantee is one fixture-anchor change from evaporating silently. The
fixture anchors on the first commission (by `created_at`) holding a `staff_admin`; in the live
seed that is CCIH with 6 cases, but **`Comissão de Farmácia B` in the same seed has zero**, so
the exposure is not theoretical. **Fix:** add a t2-class control
(`count(meeting_cases) for k.mtg > 0`) — one line — which also makes the pin fail loudly rather
than quietly if the seed ever stops providing a case.

*Checked and clean:* t18–t21 and t30 are structurally safe by contrast — their sibling rows
come from unconditional `select … from k` inserts. t17 is controlled by t6, t23 by t1, t26 is
its own control, t31/t32 are `throws_ok`. **t25 is the only one.**

### 3.5 · The `ARM=census` / `ARM=wrapper` vacuity premise — **right in substance, over-stated in the record**

I read ARM 3's and ARM 5's domain queries in
`supabase/tests/mutation/p0-authz-invariant.sh:337-444` and `:459-500`:

| ARM 3 (census) domain clause | this change |
| --- | --- |
| `prosecdef` **and** `typname = 'bool'` | guards return `trigger`, door returns `void` → **out** |
| `prosecdef` **and** `proretset` **and** authenticated EXECUTE | both `proretset = f` → **out** |
| `public` **and NOT** `prosecdef` **and** plpgsql **and** authenticated EXECUTE | both `prosecdef = t` → **out** |
| every RLS policy in `public` | none touched → **out** |

ARM 5 is the `prosecdef = f` half by construction; both objects are `prosecdef = t`. **So the
reasoning is correct for the two arms named:** neither arm would have said anything about this
change, and running them adds no coverage of it. The sweep was not skipped on a bad premise,
and the instruction to cite pgTAP `350`/`351` rather than the arms is right.

⚠ **But the record over-states it.** `PROGRESS.md:114-115` says *"neither changed function is
in **any arm's** domain"*, and that is false: **ARM 2 (`floor`)'s domain is `public` +
`prosecdef` + authenticated-EXECUTE, which contains `public.dispose_meeting_minutes`.** Its
verdict cannot have changed (same signature, same callers, still driven by `348`/`351`), so
nothing is missing — but "no arm" is one clause wider than what was measured, and CLAUDE.md §6
step 5 is explicit that a gate record must name the arm and claim only what that arm asked.
This is a **wording fix, not a re-run**. *(Related and pre-existing: ADR 0129's own obligations
list asserts "a changed DEFINER body re-enters both domains" — also false by the script above.
Worth correcting while the file is open.)*

---

## r2 · 4 — Part 3: is the retention disclosure complete?

**I checked ADR 0056 Amdt 1's classification against the catalog column by column, over the
full 113-column census.** Every retained free-text-capable column on the closure is accounted
for, and the four disclosed lines match the four columns judged PHI-capable:

| Table | Redacted by the door | Retained + classified | Disclosed to the subject |
| --- | --- | --- | --- |
| `meetings` | `minutes_md` | `title`, `status`, `modality`, `location_text`, `meeting_url`, `quorum_rule_type`, `phi_disposed_reason`, `visibility_policy`, `securable_type` | `title` |
| `meeting_agenda_items` | `title`, `description`, `discussion_notes`, `resolution` | — | — |
| `meeting_attendees` | `note`, `external_name`, `external_org` | `role`, `attendance` | — |
| `meeting_cases` | — | `summary`, `decision` | ✅ both |
| `meeting_closed_sessions` | `label` | — | — |
| `meeting_closed_session_items` | `substance`, `decision`, `withdrawals` | — | — |
| `meeting_closed_session_item_readers` | — | *(no text column)* | — |
| `meeting_minutes_jobs` | `transcript`, `draft`, `result` | `audio_path`, `service_job_id`, `error_code`, `error_message` | ✅ the audio recording |
| `meeting_signatures` | — | `method`, `status`, `content_hash`, `provider_ref`, `provider_payload`, `user_agent`, `note` | ✅ `note` |

**No column is left both unredacted and unclassified. The slice did not reproduce its own
defect.** The enumerated-not-free-text calls are catalog facts rather than assertions — I
pulled every `CHECK` on the nine tables, and `meetings.{status, modality, quorum_rule_type,
visibility_policy, securable_type}` and `meeting_attendees.{role, attendance}` each carry a
value list. ✅

**Both arms of the disclosure are non-vacuous, and the gating is derived correctly.**

- Task inbox (`src/components/dsr/dsr-task-inbox.tsx:385`) gates on
  `task.kind === 'dispose_meeting'`; the three non-meeting disposal kinds render only the
  shared notice.
- Outcome record (`src/components/dsr/dsr-outcome-record.tsx:235`) gates on
  `record.meetingMinutesDisposed`, derived at `src/lib/queries/dsr.ts:527` as
  `some(kind === 'dispose_meeting' && status === 'done')`. I verified the status domain from
  the catalog — `dsr_tasks_status_check` admits exactly `{pending, done, blocked}`, and a
  **retired** task is `blocked`, so it cannot trigger the disclosure. ✅
- ⭐ And `done` is not merely bookkeeping: `public.complete_dsr_task` refuses `HCDS3` for a
  `dispose_meeting` task unless `meetings.phi_disposed_at is not null`. So
  `meetingMinutesDisposed = true` **implies the door actually ran** — a stronger guarantee
  than the docblock claims for itself.
- `src/components/dsr/dsr-meeting-residue.test.tsx` pins both arms in one file with
  proof-of-life on the negative side (the shared notice must still render), plus a merge guard
  on the two constants. That is the right shape, and it is why I am not blocking here.

### N4 — two free-text columns are retained on an *assumption*, and the classification is internally asymmetric (non-blocking)

`meetings.{location_text, meeting_url}` are retained and **not** disclosed, on the stated
ground *"free text, but not patient-referencing by design"*. Every other not-disclosed call in
that paragraph rests on a catalog fact (a `CHECK`) or a legal-integrity argument; these two
rest on expected operator behaviour. That is the same reasoning the slice **rejected** one
table over — `meeting_agenda_items.title` was redacted precisely because free text carries what
nobody intends it to. And it sits beside a column on the *same table*, `meetings.title`, judged
PHI-capable and disclosed on an argument that applies equally to `location_text`. Either the
asymmetry gets a sentence, or `location_text` joins line 1.

### N5 — `meetings.phi_disposed_reason` is called "coded/enumerated" and the catalog does not agree (non-blocking)

There is **no `CHECK`** on that column (I pulled all 12 checks on `meetings`); the allow-list
lives inside the four `dispose_*` doors. Meanwhile `pg_class.relacl` grants `authenticated`
table-level UPDATE, `meetings_staff_admin_update` admits
`is_staff_admin_of OR member_can(…,'schedule_meetings')`, and `app.guard_meeting_status`
permits non-status edits below rank 3 — so a `staff_admin` can write arbitrary text into it on
an unlocked meeting. The practical risk is negligible; the *stated reason* is the B1 shape
again (a constraint read rather than constructed). Restate as "written only by the four
disposal doors, each against a five-value allow-list".

---

## r2 · 5 — Part 4: the twice-corrected claim

**The final narrowed form is ACCURATE. I could not find a third error in it.** Measured:

1. `app.guard_meeting_status`' live transition list is `scheduled→{held,cancelled}`,
   `held→{in_signature,cancelled}`, `in_signature→{signed,held,cancelled}`,
   `signed→{distributed,held}`. **No arm has `old.status` of `distributed` or `cancelled`** —
   both are terminal. So the reopen corridor covers exactly `in_signature` and `signed`, i.e.
   **two of the four states the child lock covers**, exactly as ADR 0056 Amdt 1 §1 (`:205-210`)
   states. ✅
2. `public.reopen_meeting(uuid)` gates on `app.is_staff_admin_of(v_commission_id)` **alone**;
   `public.dispose_meeting_minutes` gates on `is_staff_admin_of` **OR** `is_tenancy_admin_of`.
   The mismatch is real and stated correctly (`:211-213`). ✅
3. The corridor's cost is accurate too — `reopen_meeting` sets every `signed` signature to
   `revoked` and does `revision = revision + 1`, and it is the only writer of that counter. ✅

`src/lib/dsr/messages.ts:110-131` carries the same narrowed form. **The copy correctly states
the retention as a fact and promises no remedy**, which is the right call given (1) and (2).

⚠ **N6 — but the refuted absolute form survives in a file added this round.**
`src/components/dsr/dsr-meeting-residue.test.tsx:181-183`:

> `update_meeting` refuses unless the meeting is scheduled/held, so on the locked meetings
> disposal targets there is **NO path** to edit a title.

That is verbatim the reasoning the lead refuted and ADR 0056 spends a paragraph correcting —
*"a gate tells you what it refuses; only the transition graph tells you what is reachable"* —
restated as the rationale for a test written *after* the correction. The **assertion** is still
right (the copy must not say "edit it first"); its stated **reason** is the falsified one. One
comment edit.

---

## r2 · 6 — Blocking items

### ⛔ B3 — the N1 closure record states a grep result that is false, and the file that falsifies it is introduced three lines later

`docs/progress/follow-ups.md:4351-4356` records the closure evidence as:

> ⛔ **The verification scope is REPO-WIDE over `src/`, not file-local (corrected at QA r1).**
> … Widened and re-run: `grep -rn "apaga permanentemente\|todos os campos com dados\|tudo
> apagado" src/` exits **1**.

Measured just now, on the tree as it stands:

```
$ grep -rn "apaga permanentemente\|todos os campos com dados\|tudo apagado" src/
src/components/referrals/referral-dispose-dialog.test.tsx:58: * The shipped defect read "…apaga permanentemente … TODOS OS CAMPOS com dados
$ echo $?
0
```

**It exits 0, not 1.** And the offending file is the one the *next paragraph of the same
record* introduces as the closure's own evidence (*"✅ Executable coverage now exists —
`referral-dispose-dialog.test.tsx`"*). The r1 fix cleaned three files and seeded a fourth in
the same round.

This is not a nit, for three reasons that are all this program's own stated positions:

1. The verification instrument for `FUP-DISPOSE-DIALOG-OVERCLAIM` **is** this grep. A closure
   record asserting a specific exit code that is wrong is a gate record claiming more than was
   measured — CLAUDE.md §6 step 5, and the same class as r1's **B1**.
2. `DSR_RESIDUE_NOTICE`'s own docblock (`src/lib/dsr/messages.ts:83-87`) states the rule *and*
   why — *"prose warning the next reader off the strings is indistinguishable from the strings
   themselves"* — and was corrected for exactly this.
   `src/components/dsr/dsr-meeting-dispose-dialog.tsx:59-60` states it a second time and calls
   it **repo-wide**. The rule is stated in two files this round and violated in a third.
3. It is the **third** iteration. The record's own closing line reads *"Three separate authors
   each wrote a correct warning that became either false or self-defeating."* That is now four.

**Fix (two edits):** rewrite `src/components/referrals/referral-dispose-dialog.test.tsx:56-59`
to describe the over-claim class in English without reproducing the pt-BR strings — the file
already does this correctly one line later with `TOTALITY_QUANTIFIER`, which is the *right* way
to name the class — and correct the exit-code sentence in `follow-ups.md` (and its archive
copy, if it carries the same claim) to whatever is true after that edit.

⭐ **The lesson worth recording alongside the fix:** this defect has now recurred three times
because the rule is prose and the detector is manual. It costs one script to make it a gate,
and CLAUDE.md §8's own admission rule says a standing prohibition a gate can enforce belongs in
`scripts/`, not in a comment.

### ⛔ B4 — `351` t25 passes on an empty population (proven by construction), while ADR 0056 Amdt 1 cites it as a guarantee

Full evidence in §3.4. The pin violates the suite's **own** stated discipline (`351:31`), it is
the only conditional fixture insert in the file, and the differential run shows 32/32 green
with `meeting_cases` empty. ADR 0056 Amdt 1 relies on it twice. **Fix:** one
`cmp_ok(…, '>', 0, 'CONTROL: the target HAS a meeting_cases row')` before t25, and bump `plan()`.

*Why this blocks rather than being an N.* This project treats a green assertion that proves
nothing as a defect class with its own lint gate and its own audit
(`docs/reviews/vacuous-assertion-audit.md`); the suite header names the class, and the author
already caught one instance (t22) by mutation. A second instance shipping in the same file —
cited in an Accepted ADR as the thing that makes a future widening deliberate — is that class
recurring inside the fix for it.

---

## r2 · 7 — Non-blocking findings

**N7 — the live catalog now carries two sentences this very migration falsified.** CLAUDE.md's
standing position is that the catalog, not the file, is truth. Read from `pg_get_functiondef`
*after* the migration:

- `app.guard_meeting_child_lock` (live body): *"`public.dispose_meeting_minutes` is the only
  function that sets this flag, and **this guard is its only reader**."*
- `public.dispose_meeting_minutes` (live body): *"⚠ **All three tables** updated inside this
  window are guarded by `app.guard_meeting_child_lock`, which is the **flag's ONLY reader**."*

Both are now false — there are **two** readers, and **four** tables are written inside the
window (the fourth, `meeting_closed_session_items`, is guarded by the *other* function). The
migration amended ADR 0129's prose for precisely this reason, saying so in its own header
(*"corrected here rather than left to rot, because a stale bound in the ADR that documented a
stale comment is the defect this ADR was written about"*) — and then left the same bound stale
in the two places a future reader is most likely to trust. `CREATE OR REPLACE` was already
being issued for both functions, so the correction was one line each in the migration that
shipped.

**N8 — `PROGRESS.md:114-115` "neither … is in any arm's domain"** overstates by one arm
(ARM 2 / `floor` contains the door). See §3.5. Wording only.

**N9 — N4 / N5:** two free-text columns retained on an assumption, and one column classified as
enumerated that the catalog does not enumerate.

**N10 — the refuted no-remedy claim survives at
`src/components/dsr/dsr-meeting-residue.test.tsx:181-183`.** See §5.

**N11 — `FUP-DOOR-ERASURE-FREETEXT-CENSUS` now has its enumerator, and it works.** My r1 **N3**
said the follow-up named no mechanism. This slice supplied one — composition closure by
`NOT NULL + ON DELETE CASCADE`, then every free-text-capable column minus the door's measured
erasure set — and I reproduced it end to end for the meetings lane in about ten minutes. It
should be lifted out of ADR 0056 Amdt 1's prose into the follow-up itself as the *procedure*
for the other three doors, with the three refinements this run needed spelled out: bound the
type filter by `typcategory` / `typtype` / `typelem` / `attgenerated` rather than by a type
list; check `pg_inherits` and `relkind`; and run the whole census inside one snapshot.

---

## r2 · 8 — Could not verify (a work item, not coverage)

- **The 17/17 mutation-RED claim for `351`.** I ran the suite and read every pin, and I
  constructed the one differential that mattered to my verdict (t25). I did not re-run the
  other sixteen neutralizations — mutating shared-stack function bodies is outside a read-only
  reviewer's rollback guarantee, and the ADR records both directions for the stand-aside
  specifically.
- **`ARM=floor` / `ARM=hat` on this tree.** `ARM=floor` resets `pg_stat` and alters a database
  setting on the shared stack; I did not run it. Its verdict for `dispose_meeting_minutes`
  cannot have changed (same signature, same callers, still driven by `348`/`351`), which is the
  basis for §3.5's "wording fix, not a re-run".
- **Whether operators actually put patient names in `meetings.title` / `location_text`.** Still
  the unmeasured premise under N4 and under the whole widening — carried from r1 unchanged. No
  catalog probe answers it.
- **Browser behaviour of any dispose surface.** Accepted as known
  (`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE`); the jsdom tests are not a browser and I did not
  treat them as one.

---

## r2 · 9 — Summary

| Item | Verdict |
| --- | --- |
| B1 — false ACL claim in three records | ✅ **Closed**; replacement claim verified at both grains + inheritance |
| B2 — stranded follow-up | ✅ **Closed by building the fix** |
| N1 — repo-wide grep prohibition | ⛔ **Re-opened as B3** — record claims exit 1, measures exit 0 |
| Composition closure (9 tables, depth 3) | ✅ **Re-derived from the catalog; exact match** |
| Third blind spot (arrays / domains / hstore / generated / partitions) | ✅ **None exists** — 113-column census |
| Guard change bounded (1 setter, 2 readers, no client-settable GUC) | ✅ **Verified**; ADR 0129 Amdt 1's reasoning is sound |
| Transcript purge (set-based, no `limit 1`, no sibling residue) | ✅ **Verified** |
| `351` fixture genuinely locked | ✅ **Verified** — t1 + both guards' live status sets |
| `351` t25 | ⛔ **B4 — vacuous, proven by construction** |
| `ARM=census` / `ARM=wrapper` vacuity premise | ✅ **Correct**; ⚠ "any arm" overstates (N8) |
| Retention disclosure completeness | ✅ **Verified against the catalog — every retained column classified** |
| Both disclosure arms non-vacuous; `done` implies the door ran | ✅ **Verified** |
| The twice-corrected reopen claim, final form | ✅ **Accurate** — both limits reproduce exactly |
| Live catalog carries two sentences this migration falsified | ⚠ **N7** |

**B3 and B4 are one edit each plus a one-line pgTAP control.** No door change is required and
nothing in the widening needs revisiting. Once they land — with N7's two comments corrected in
the same pass, since they sit in the migration that will be re-run anyway — this is an
`APPROVED`.

**What this round got right, and it is a lot.** The build refused a list and derived a
property. It found a *verbatim meeting transcript* surviving an Art. 18 erasure — a far more
serious finding than the one it was sent to fix — and recorded that the finding falsified ADR
0056 §4 rather than only the UI copy. It caught its own vacuous keystone by mutation and wrote
up *why* the first version could never fail. And it narrowed the lead's own refutation with two
measured limits that I reproduced exactly from the catalog.

The two blocking items are, once again, not in the engineering — they are in the sentence that
describes it. A grep whose recorded exit code was never re-run after the last file landed, and
a pin that asserts nothing when its fixture is empty.

---

# DSR Slice 4 — QA review, round 3

**Verdict: `APPROVED`**

Both r2 blockers are closed, and **B4's fix is proven rather than asserted** — I re-ran my own
r2 falsification probe and it now goes red, and I built the opposite-direction probe the build
claimed but did not construct. N7 is closed in the catalog. Three non-blocking findings follow,
one of which is new and worth carrying: **the suite's authorization control asks the wrong
catalog**, and the fixture only passes today because a UUID tie-break lands on the one persona
the door admits.

None of the three changes any verdict. All are one-line fixes.

---

## r3 · 1 — Method and rollback

Live catalog only, on `supabase_db_azkbbhskturikxpgmafq`. Rollback proven in **both**
directions before and after every probe, over two independent subjects:

```
public.meetings        3|f65fe06f2d1413463c4ac0910b21c06c   (before and after — identical)
public.meeting_cases   1|7972f63649887dd16b9cd37d761588eb   (before and after — identical)
pg_extension pgtap     installed to run 351, then dropped -> 0
public.meeting_closed_session_items -> 0 rows left behind
```

Suite `351` run live: **33/33 `ok`**, and the numbering claim holds — t26–t32 keep their
numbers and t33 is appended, so the `351` t8 / t25 / t31 / t32 citations in ADR 0056 Amdt 1 and
ADR 0129 Amdt 1 still resolve.

---

## r3 · 2 — B3 · CLOSED

`grep -rn "apaga permanentemente\|todos os campos com dados\|tudo apagado" src/` → **exit 1**,
reproduced. `referral-dispose-dialog.test.tsx:56-67` now describes the class in English
(*"a permanence adverb paired with a universal quantifier"*) and keeps the executable
`TOTALITY_QUANTIFIER` regex, which is the right instrument.

**The record is honest about what remains unguarded, which is what I was asked to judge —
and it is more honest than it had to be.** `FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING`
states the PO's record-only ruling plainly, predicts a fifth recurrence, and then does the
thing that makes a record-only entry defensible: it names the residual explicitly rather than
letting silence imply coverage —

- it records that the grep is unsound in **both** directions (false-positive on prose *about*
  the defect; **false-negative on a reworded instance** — the fourth instance matched only
  because the pattern happened to contain the phrase it used);
- it names what actually guards the property today (the mutation-proven component tests, on
  **rendered output**, which is a stronger instrument than the grep) **and the exact gap that
  leaves**: *"a new dispose surface with no test is unguarded."*

That last clause is the one that matters. A record-only ruling on a recurring class is only
honest if it says what is still exposed, and this one does, in the specific terms a future
reader can act on. I have no finding here. I also do not re-litigate the gate decision.

The corrected sentence at `follow-ups.md:4360-4363` states the failure plainly — that it
exited 0 when written, and that the matching file was the one the next paragraph introduces as
the closure's evidence. Correct.

---

## r3 · 3 — B4 · CLOSED, and the fix is proven in both directions

### 3.1 · The three changes verified

1. **The anchor now requires `exists (select 1 from public.cases ca where ca.commission_id = c.id)`**,
   so the suite's only conditional insert is unconditional. ✅
2. **t25 asserts in the positive** — `count(rows still holding their exact original text) = 1`. ✅
3. **t33 appended last**, numbering preserved. ✅

### 3.2 · Falsification probes — I built four, all inside the suite's own transaction

| probe | construction | result |
| --- | --- | --- |
| **A** | my r2 probe, re-run verbatim: `where false` on the `meeting_cases` insert | **t25 RED + t33 RED** (`failed 2 of 33`) |
| **C** | the *other* direction — simulate a widened door by redacting `meeting_cases` inside the `app.in_disposal_rpc` window, just before t25 | **t25 RED, alone** (`failed 1 of 33`) |
| **D** | keep the `exists` fix but let the tie-break select a different **qualifying** commission | **16 RED**, t8 dies `42501` — see §4.2 |
| **B** | revert the anchor fix *and* steer to the zero-case commission | 18 RED (confounded by the same `42501`; A is the clean probe) |

**Probe A is the decisive one.** The identical mutation left the r2 suite **32/32 green**; it
now takes down both t25 and t33. That is the vacuity closed by construction, not by argument.

**Probe C is the half the build claimed but did not construct**, and it comes out exactly as
claimed and no wider: a widened door reds **t25 and nothing else** — no collateral, no
ambiguity about which pin noticed. So "fails both ways" is now measured in both ways.

### 3.3 · The t33-placement argument holds — I checked the conjunction rather than the conclusion

The trade (locality for citation stability) is sound, and all of its premises are true:

- **Nothing between t25 and t33 writes `meeting_cases`.** t26–t30 are SELECT-only pins;
  t31/t32 are `throws_ok` over `meeting_closed_session_items` (a different table, and the
  statements raise); the rest are `set_config`. No trigger on any of those tables writes
  `meeting_cases` — I checked `pg_trigger` for the closure in r2 and the set is unchanged.
- **The suite is a single transaction** — `begin … rollback`, and the fixture temp table is
  `on commit drop`, which could not survive a commit in between.
- **A fourth premise the argument does not state, and which also holds:** t33 must actually
  *run*. If anything between t25 and t33 aborted the transaction, t33 would never execute —
  but pgTAP's `finish()` reports the plan shortfall and the harness fails, so that state is
  loud rather than silent. Worth one clause in the comment, since the argument turns on it.

t33 is not merely redundant with t25's positive form either: t25 counts rows carrying the
original text, t33 counts rows for the meeting, so a second, redacted `meeting_cases` row would
pass t25 and red t33. It earns its place.

*Minor:* t25 hard-codes the fixture's literals (`'Resumo do caso com PHI'`) instead of reading
them from `k`. It fails closed if someone edits the fixture strings, so this is noise risk, not
a soundness risk — but a `k` column would remove it, as the file already does for `redacted`.

---

## r3 · 4 — Findings (all non-blocking)

### ⚠ N12 — the build's correction of my r2 finding is itself wrong, and its own comment contradicts it two sentences later

The build reports that my r2 finding *understated* the problem: that all six commissions share
an identical `created_at`, and that `Comissão de Farmácia B` (0 cases) *"was already a live
winner."*

**The first half is true and is a genuine sharpening of my r2 wording** — I said "the first
commission by `created_at`", and the truth is better than that: `created_at` is a **total tie**
(6 commissions, `count(distinct created_at) = 1`), so the anchor's winner was decided
*entirely* by `min(mm.principal_id)`. The ordering is an accident of seed UUIDs, not of time,
and that is a stronger statement of the fragility than mine. I accept the correction of grain.

**The conclusion is false.** Under the *old* anchor, measured on this database:

```
rank | commission                                  | principal_id                         | cases
   1 | Comissão de Controle de Infecção Hospitalar | 00000000-...-000000000002            |     6   <- winner
   2 | Comissão de Farmácia e Terapêutica          | 00000000-...-000000000005            |     1
   3 | Comissão de Qualidade e Segurança           | 00000000-...-0000000000b2            |     1
   4 | Comissão de Farmácia B                      | 00000000-...-0000000000b3            |     0   <- LAST
```

`Comissão de Farmácia B` was **rank 4 of 4** — the furthest thing from a winner, under
ascending order on the only column that discriminates. No ordering available to the old anchor
(`created_at` then `principal_id`, or `c.id`) selects it. t25 was **vacuity-capable**, exactly
as r2 said, not already vacuous, and probe A remains the correct demonstration.

The shipped comment (`351:80-88`) contains its own refutation: it says Farmácia B *"was already
a live winner"* and, in the next sentence, that the pin was *"one seed shuffle from permanent
vacuity."* Both cannot be true — if it were already the winner, no shuffle would be required.

Two things make this worth writing down rather than waving through. It is the **third** time in
this program that a finding's *direction* was corrected while its *magnitude* was re-derived
wrongly, which is a named pattern in this repo's own memory. And the confirmation offered —
*"I confirmed the zero-case fact independently"* — is a true statement about a **different
proposition**: Farmácia B having zero cases does not bear on whether it was selected. That is
the wrong-grain-predicate shape, in the sentence certifying the correction.

**None of this touches the fix**, which is correct and strictly stronger than what I asked for.
Only the rationale comment needs one sentence: *Farmácia B sorted last, so the pin was
vacuity-capable rather than vacuous; the exposure is that the ordering is a pure UUID tie-break.*

### ⭐ N13 — t7 asks `memberships`; the door asks `has_role`, which is `memberships` **and the caller's active hat**. Of the three commissions the anchor may legally select, one is refused.

This is new, and it is the finding I would most want carried forward.

t7's own message states its purpose: *"the persona really is staff_admin, **so t8 reaches the
redactions instead of stopping at a 42501**."* It establishes that by reading the membership
row (`mm.role = 'staff_admin'`). The door does not ask that question. `app.is_staff_admin_of`
→ `app.has_role`, whose final conjunct is:

```sql
and (p_user_id is distinct from auth.uid()
     or p_role is not distinct from app.active_role())
```

So when the probed principal **is** the caller, the membership row is not sufficient — the role
must also be the caller's **active** hat. t7 cannot see that conjunct, and the failure it exists
to pre-empt is precisely the one it is blind to.

Measured, each persona under **its own** `claims_for` claims with `set local role authenticated`:

```
CCIH            / chefe.ccih@test.local (…0002)  ->  is_staff_admin_of = t     <- today's winner
Farmácia e Ter. / chefe.farm@test.local (…0005)  ->  is_staff_admin_of = t
Qualidade e Seg / orgadmin.b@test.local (…b2)    ->  is_staff_admin_of = f     <- door REFUSES
```

All three qualify under the new anchor (staff_admin membership + ≥1 case). Probe D selects the
third and the suite goes **16 red**, headed by

```
# Failed test 8: died: 42501: apenas a coordenação da comissão ou um administrador da organização
```

while **t7 stays green**. `orgadmin.b` holds a `staff_admin` membership on that commission and
an `org_admin` hat elsewhere; its `active_role()` is not `staff_admin`, so the door refuses a
principal the control just certified.

**Why this is non-blocking:** it fails *loud*. Nothing goes green that should be red, and the
suite passes today. But the fixture's determinism now rests entirely on `min(principal_id)`
among qualifying commissions — the very accident the build itself identified — and the failure
mode is a 16-test cascade whose diagnostic points at authorization rather than at the anchor.

**Fix, one line:** assert the door's own predicate after `claims_for` and before t8 —
`select ok(app.is_staff_admin_of((select comm from k)), 't7b: the door's OWN gate admits this
persona')`. That converts a confusing 16-red into one self-explaining red, and it is the same
rule `lint:memberships-door` enforces in TypeScript (*never read `memberships` where a
`has_role` door exists*) recurring in pgTAP, where no gate covers it.

⚠ **This review nearly missed it the same way, and the near-miss is the point.** My first probe
evaluated `app.has_role('commission', c.id, 'staff_admin', mm.principal_id)` as **superuser**
and got `t` for all four commissions — reassuringly. That is the hat conjunct short-circuiting
on `p_user_id is distinct from auth.uid()`. The predicate only tells the truth when asked
**under the caller's own claims**, which is the `ARM=hat` lesson expressed in a single boolean.

### ⚠ N14 — the "grantable → granted" fix landed in the right place, but in **one of three** copies

Confirmed at ADR 0130 `:275-278`, and better than I asked: it names the role-inheritance grain
explicitly (*"table, column, or via role inheritance"*) and adds the distinction in-line
(*"'granted', not 'grantable': the owner may grant it at any time"*). ✅

But the same sentence exists in two other places and both still read *grantable*:

```
docs/progress/follow-ups.md:4444          "no INSERT privilege grantable to `authenticated` at any grain"
docs/progress/follow-ups-archive.md:2266  "no INSERT grantable to `authenticated` at any grain"
```

(The other `grantable` hits in the repo are unrelated, pre-existing uses about case-access
capabilities.) This is the same three-copies shape as **B1** itself, whose correction *was*
applied to all three. Worth noting only because the question asked was "no second instance
survives", and two do.

---

## r3 · 5 — N7 · CLOSED, verified in the catalog rather than the migration

Both live bodies, read from `pg_get_functiondef`:

- `app.guard_meeting_child_lock` — *"⚠ THIS GUARD IS NO LONGER ITS ONLY READER —
  `app.guard_reserved_child_lock` … TWO readers, ONE setter. The bound ADR 0126 section E rests
  on is the SETTER count, not the reader count."*
- `public.dispose_meeting_minutes` — *"⚠ FOUR tables are updated inside this window, and they do
  NOT share one guard … TWO readers, still exactly ONE setter (this function)."* It also keeps
  the superseded sentence as a marked correction, which is the right treatment.

**Was "348 green" sufficient evidence that the guard's executable logic is unchanged? In
practice yes; but it is not the direct proof, so I took the direct one.** A behavioural suite
demonstrates that the properties it tests still hold; it cannot show that *nothing else*
changed — a swapped `old`/`new`, an extra status in the locked set, or a dropped cascade branch
could each survive a green run. I stripped comments from the live body and compared statement
by statement against the body I captured in r2: **identical** — same declarations, same
`old`/`new` selection, same `select status into`, both cascade-null branches, the same
four-value locked set, the same flag name and `coalesce(..., true)` form, the same
`check_violation` raise. Comment-only rewrite, confirmed structurally.

ACLs and attributes preserved, no GRANT line, verified live:

```
app.guard_meeting_child_lock    prosecdef=t  proacl=NULL (PUBLIC default)  search_path pinned
app.guard_reserved_child_lock   prosecdef=t  proacl=NULL (PUBLIC default)  search_path pinned
public.dispose_meeting_minutes  prosecdef=t  {postgres=X,service_role=X,authenticated=X}  (anon: none)
```

The guards' NULL `proacl` is *preserved*, which is what "no GRANT line" should produce — and it
remains inert for the reason given in r2 (a plpgsql trigger function raises when called
directly; schema `app` is not PostgREST-exposed).

---

## r3 · 6 — Also fixed since r2, verified

- **`PROGRESS.md:114-117`** now reads *"neither changed function is in **those two** arms'
  domains … ⚠ **not 'no arm'** — `ARM=floor` does contain `dispose_meeting_minutes`"*. Exactly
  the narrowing r2 asked for, with the arm named. ✅
- **The stale suite citation** is fixed to *"Cite pgTAP **351**, never the arms."* I checked the
  remaining `350` references and they are **correct, not stale** — `PROGRESS.md:79` and
  `follow-ups.md:5019,5035` all refer to `350_dsr_adjudication_and_attested_tier.sql` (Slice 3),
  which genuinely is suite 350. The sweep did not over-correct. ✅

---

## r3 · 7 — Summary

| Item | Verdict |
| --- | --- |
| **B3** — grep prohibition + false closure sentence | ✅ **Closed**; grep exits 1, record honest about the residual |
| **B4** — `351` t25 vacuity | ✅ **Closed**; r2's own probe now reds t25 **and** t33 |
| t25 fails the *other* way (widened door) | ✅ **Proven** — probe C reds t25 alone |
| t33 placement (locality traded for citation stability) | ✅ **Conjunction verified**, incl. the premise the comment omits |
| Numbering stability (t26–t32, the four ADR citations) | ✅ **Preserved** |
| **N7** — two false sentences in the live catalog | ✅ **Closed**; logic proven unchanged by comment-stripped diff, ACLs preserved |
| **N8** — "any arm's domain" | ✅ **Narrowed**, `ARM=floor` named |
| "grantable → granted" nit | ⚠ **N14** — right place, 1 of 3 copies |
| Anchor rationale: "Farmácia B was already a live winner" | ⚠ **N12** — false; it sorted **last**. The `created_at` tie half is a real sharpening |
| t7's control grain vs the door's `has_role` hat conjunct | ⭐ **N13** — new; 1 of 3 legal anchors is refused, t7 green while t8 dies 42501 |

**`APPROVED`.** N12, N13 and N14 are one sentence, one pgTAP line, and two word swaps
respectively; none blocks, and N13 in particular is a fixture-robustness improvement rather
than a correctness defect. I would land N13 before this suite is cited in another ADR, because
its failure mode is a sixteen-test cascade with a misleading diagnostic.

**The thing this round got right.** B4's fix did not just add a control — it changed t25 from a
negative to a **positive** assertion, which is the structural cure for the class rather than a
patch on the instance: a pin that requires its subject to *exist and be unchanged* cannot pass
by having no subject. That is the same move that fixed t22, applied deliberately the second
time instead of discovered by mutation. And the t33 placement decision — accepting worse
locality to avoid renumbering four citations in two Accepted ADRs — is precisely the
stale-record defect this slice has been fixing all week, declined in advance.

**And the thing to carry.** Twice now, this program has corrected a QA finding and got the new
magnitude wrong in the same breath (N12) — and the sentence certifying the correction confirmed
a neighbouring proposition rather than the one at issue. A correction is a claim, and it needs
the same construction the original did. My own near-miss in N13 is the same lesson from the
other side: I asked the right predicate with the wrong `auth.uid()`, and it answered `t` four
times running.
