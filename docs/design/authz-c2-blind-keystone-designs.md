# Keystone design for the three BLIND command-door guards

**For:** `FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS` (`docs/followups/follow-ups-open.md` ~L1114)
**Source finding:** `docs/design/authz-c2-command-door-neutralizer.md` §8
**Written:** 2026-09-02, **design only** — no test file written, no DB touched (the
`c2-command-door-neutralizer.sh` sweep owns the local DB and its `Files=259, Tests=8685` baseline (re-measured 2026-09-02 on this branch; the 248/8289 figure is the pre-AE4 one)).

> ⛔ **All three designs are KEYSTONES, never allowlist entries.** Each of the three doors *also*
> currently sits in `supabase/tests/mutation/authz-neverclled-door-allowlist.txt`
> (lines **73** `cancel_event`, **74** `cancel_session`, **99** `nsp_org_capa_rollup`). That is the
> exact `allowlisting-a-door-as-e2e-only-is-what-makes-it-blind` state: `ARM=floor` is told not to
> ask, and the C2 arm found nothing asking. Each keystone below therefore carries an **allow leg**
> (a *successful* call), because `pg_stat_user_functions` does not count a call that raises — a
> deny-only `throws_ok` drives the door but leaves it at 0 recorded calls and cannot retire the
> allowlist line. **Delete the allowlist line in the same commit as the keystone** (the
> `rca_writer_can_write` / `142_rca.sql §K` precedent, 2026-08-24).

> ⛔ **READ ALONGSIDE `FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`.** The harness anchor
> `HC0[A-Z0-9]{2}` is a **syntax, not a property**: it sweeps in non-authz **state** guards (`HC038`,
> `HC043`) and misses real authz codes (`HCDS*`, `28000`). That is why §0 below matters so much —
> `cancel_session`'s anchored raise is a STATE guard, and its authorization (HC039) is a different
> worklist row entirely. ⛔ **Writing a keystone against the wrong code produces a green that proves
> nothing and reads like a fix.**
> ⚠ Also: these three doors sit in `authz-neverclled-door-allowlist.txt`, which lives under
> `supabase/tests/**`. **No file there may be touched while the sweep runs** — it would void the
> baseline. Keystones and allowlist deletions land AFTER the sweep completes.

---

## 0 · What the harness actually mutates — read this before designing anything

This changes two of the three designs, so it is stated first.

`c2-command-door-neutralizer.sh` `mutate()` rewrites, **inside the target enforcer's own body only**:

```
raise\s+exception[^;]*?errcode\s*(=|=>)\s*'(42501|HC0[A-Z0-9]{2})'\s*;   →   null;
```

Three consequences that the keystone must be designed around:

1. **The anchor is `42501` or `HC0xx` only.** A raise using `no_data_found`, `P0002`, `23505` or
   `23514` **survives the mutation untouched**. A keystone that pins one of those codes will stay
   green under mutation and the verdict will not move.
2. **Only the target's own body is rewritten.** A guard the door *delegates* to (e.g.
   `app.assert_interview_writable`) is a **separate enforcer with its own worklist row**. Pinning
   the delegate does not flip the door's verdict — and vice versa.
3. **All anchored raises in the body go at once**, so pinning *any one* of them is sufficient to
   turn the mutated run red. Pinning the *authorization* one is still the right choice where one
   exists, because that is the property under test.

⚠ **`nraise` in the findings table is the ANCHORED count, not the total raise count.** The
"UNMUTABLE" ERROR fires when the count of anchored errcodes differs from the count of anchored
errcodes *followed by `;`* — not when the function has unanchored raises. All three targets below
were mutable and returned a real BLIND.

---

## 1 · `public.nsp_org_capa_rollup(p_org_id uuid)` — the ordinary shape

### 1.1 The guard

Defined at `supabase/migrations/20260710000000_nsp_per_hospital.sql:1559`.

```sql
if not app.is_nsp_org_admin_of(p_org_id) then
  raise exception 'apenas o administrador de NSP da organização pode ver este relatório'
    using errcode = '42501';
end if;
```

- **Single anchored raise.** Neutralized → the function falls straight through and returns the
  per-hospital open/overdue/closed CAPA rollup **for any organization, to any authenticated
  caller**. Cross-tenant aggregate disclosure derived from the PHI-marked NSP relations (this is
  why it is a C2 Tier-1 door: `supabase/tests/mutation/c2-tier1-doors.txt:149`).
- Enforcer chain: `app.is_nsp_org_admin_of(org)` → `app.is_nsp_org_admin_of_for(org, auth.uid())`
  (latest: `supabase/migrations/20260720000100_has_role_predicate_family.sql:143`) →
  `app.is_active(u) and app.has_role('organization', org, 'nsp_org_admin', u)`.
- ⚠ **Hat-dependent (ADR 0106).** `app.has_role` (latest:
  `supabase/migrations/20260918002200_act_stage3_act_stage3_is_admin_hat_condition.sql:145` —
  see 4.2 for the exact filename caveat) ends in
  `and (p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())`.
  The door calls the **self** form, so the caller must be *wearing* the `nsp_org_admin` hat, not
  merely hold the role.

### 1.2 Why the suite is blind to it

**The ordinary shape: zero pgTAP files reference it.** A full-repo `grep -rn nsp_org_capa_rollup`
returns 20 hits — the definition + its GRANT/REVOKE, two TS call sites in
`src/lib/pqs/org-admin.ts`, the generated type, docs/ADR prose, and **two mutation manifests**
(`authz-neverclled-door-allowlist.txt:99`, `c2-tier1-doors.txt:149`). **Not one is a test.**

Its two siblings `nsp_org_event_rollup` and `nsp_org_roster` — same guard, same file, same shape —
**are** exercised, in `supabase/tests/189_nsp_per_hospital_isolation.sql` §9 (L196–228), including
a `42501` deny arm. The CAPA rollup was simply never added to that section. This is the cheapest
of the three to fix.

### 1.3 The keystone

**File:** `supabase/tests/189_nsp_per_hospital_isolation.sql`, **inside §9**, i.e. the allow legs
appended after L218 and the deny leg appended after L228 — ⛔ **before L230**.

> ⚠ **Placement is load-bearing, not cosmetic.** At L235–241 the file calls
> `add_pqs_member(hosp_a2, orgadmin_a)`, giving `orgadmin.a` a **second live role**. From that
> point on a 2-arg `claims_for(orgadmin_a, false)` mints **no `active_role` claim at all**, and
> every subsequent gate denies for hat reasons rather than gate reasons. A keystone placed after
> L241 that reuses `orgadmin_a` would be **vacuous** — it would pass under mutation too, and the
> verdict would not move. Staying inside §9 avoids the hazard entirely.

**Personas** (seeded fixed UUIDs, already in the file's `personas` temp table):

| leg | persona | why |
| --- | --- | --- |
| allow | `nsporg_a` = `…0000e2` | the `nsp_org_admin` of org-a; **exactly one** membership row (`seed.sql:371`) so `claims_for`'s auto-derivation mints `active_role='nsp_org_admin'` |
| deny | `pqs_a` = `…0000c2` | a `pqs_member` of central-a — authenticated, inside org-a, holds a real NSP-family role, and is **not** `nsp_org_admin`. The tightest discriminator: a refusal cannot be blamed on tenancy or on being a stranger |

**Assertions** (3 tests; bump `select plan(53)` → `plan(56)` at L32):

```sql
-- ── allow leg (also clears the ARM=floor never-called line) ──────────────────
select test_helpers.claims_for((select nsporg_a from personas), false, 'nsp_org_admin');
set local role authenticated;
select is(
  (select jsonb_array_length(public.nsp_org_capa_rollup((select org_a from personas)))),
  2,
  'AGGREGATE: nsp_org_capa_rollup(org-a) returns 2 hospital rows (central-a + secundário-a)');
select is(
  (select bool_or(row_obj ? 'name' or row_obj ? 'mrn' or row_obj ? 'patient' or row_obj ? 'code'
                  or row_obj ? 'title' or row_obj ? 'description' or row_obj ? 'attending')
   from jsonb_array_elements(public.nsp_org_capa_rollup((select org_a from personas))) as row_obj),
  false,
  'PHI-FREE KEYSTONE: nsp_org_capa_rollup exposes NO patient/code/title/narrative key');
reset role;

-- ── ⭐ THE KEYSTONE (the blind gate) ─────────────────────────────────────────
select test_helpers.claims_for((select pqs_a from personas), false, 'pqs_member');
set local role authenticated;
select throws_ok(
  format($$ select public.nsp_org_capa_rollup(%L::uuid) $$, (select org_a from personas)),
  '42501',
  'apenas o administrador de NSP da organização pode ver este relatório',
  '⭐⭐ KEYSTONE: pqs.a (a real NSP-family role, NOT nsp_org_admin) CANNOT read the org CAPA rollup — mutation-proven BLIND 2026-08-31 (guard→null;, 8289/8289 still PASSED). Pins the door''s own MESSAGE so a missing EXECUTE grant cannot satisfy it');
reset role;
```

⭐ **Pin the message, not just `42501`.** The existing sibling at L220–228 passes `null` for the
message. `352_dispose_event_door_gate.sql:97` records why that is weaker: a bare `42501` is also
what a missing EXECUTE grant raises, so the assertion can be satisfied by something that is not
the gate. Pinning the string makes the deny leg attributable.

**Under mutation:** the guard becomes `null;`, `pqs_a` receives a jsonb array instead of an
exception, `throws_ok` fails → suite RED → verdict flips BLIND → COVERED.

### 1.4 UNVERIFIED — check against the live catalog before writing the test

- 🔴 **The migration text of this function is KNOWN STALE.**
  `supabase/migrations/20260719000500_status_keys_capa_interviews.sql:59–108` runs an unnamed
  catalog loop that matches any `app`/`public` function whose `pg_get_functiondef` mentions
  `capa_plan|capa_action|case_interviews` (and no conflicting table) and rewrites its status
  literals in place. `nsp_org_capa_rollup` matches. The **live** body therefore reads
  `'open','in_execution','in_verification'` / `'completed'` / `not in ('completed','cancelled')`,
  **not** the Portuguese keys shown in `20260710000000`. The *guard* is unaffected, but confirm
  the guard survived the re-emission verbatim: `select pg_get_functiondef('public.nsp_org_capa_rollup(uuid)'::regprocedure);`
- ⚠ **Does org-a really have exactly 2 hospitals?** The `2` above is copied from the sibling
  assertion at `189:203`. Re-derive rather than assume.
- ⚠ **Is `pqs_a` single-role?** If `…0000c2` holds ≥2 live memberships, the 2-arg `claims_for`
  mints no hat and the denial becomes hat-driven (vacuous). The explicit third argument
  `'pqs_member'` above defends against this; verify the persona genuinely holds that role or the
  allow-side of `has_role` will not be the reason it fails.
- ⚠ **Adjacent bug, do NOT fold into the keystone.** The rollup anchors CAPAs via
  `app.hospital_of_event(app.event_of_capa(p.id)) = h.id`, but `app.event_of_capa` returns NULL
  for every CAPA whose source is not `event`/`rca` (the documented class of
  `supabase/tests/317_act_capa_audit_scope.sql`), while `capa_plan.hospital_id` is NOT NULL on the
  same row (`20260711000600_capa_tenant_anchor.sql:30`). The function's own header comment claims
  such plans are "counted org-wide under an 'unscoped' pseudo-row"; **the body emits no such
  row** — they are silently dropped. A keystone asserting a `source='manual'` CAPA appears in the
  rollup would go RED *today*. That is a separate follow-up, not part of this keystone.

**Confidence: HIGH.** The sibling door, in the same file, with the same guard and the same
personas, already has exactly this shape working.

---

## 2 · `public.cancel_event(p_event_id uuid)` — the ordinary shape, with a code trap

### 2.1 The guards

Defined at `supabase/migrations/20260620000000_baseline.sql:7641`. Prologue, in order:

```sql
perform app.assert_patient_safety_enabled();                       -- 23514  ⛔ NOT anchored
if not app.can_read_event(p_event_id, auth.uid()) then
  raise exception 'evento não encontrado' using errcode = 'P0002'; -- P0002  ⛔ NOT anchored
end if;
if not app.event_current_custodian(p_event_id, auth.uid()) then
  raise exception 'apenas quem detém a custódia do evento pode cancelá-lo'
    using errcode = 'HC044';                                       -- ✅ anchored → neutralized
end if;
select status into v_status …;
if v_status in ('closed','cancelled') then
  raise exception 'este evento já está em um estado final'
    using errcode = 'HC043';                                       -- ✅ anchored → neutralized
end if;
```

⛔ **The trap.** Two of the four raises are **outside** the anchor. A keystone that asserts
`P0002` for a stranger — the intuitively "most authz-looking" test — **stays green under
mutation** and moves nothing. The keystone must land on **HC044** (the authorization guard) or
HC043 (the terminal-state guard).

Custodian semantics (both latest at `20260710000000_nsp_per_hospital.sql:437` / `:497`):

- `app.can_read_event` = member of the current-owner commission **or** of the reporting
  commission **or** a PQS operator of the event's hospital.
- `app.event_current_custodian` = a PQS operator of the event's hospital (always), **or**
  `is_staff_admin_of_for(current_owner_commission_id)` while `current_owner_kind='commission'`.

⚠ Both bottom out in `app.has_role` → **hat-dependent** (ADR 0106).

### 2.2 Why the suite is blind to it

**The ordinary shape: zero pgTAP files call it.** Two repo hits, both mutation manifests
(`authz-neverclled-door-allowlist.txt:73`, `c2-tier1-doors.txt:80`). `app.event_current_custodian`
is likewise never named by a test — `authz-unswept-backlog.txt:197` records that mutating it is
caught **only** by the `acknowledge_event` HC044 assertion at `140_patient_safety.sql:151`, i.e.
by a *sibling* door. Cancelling an event is simply an untested path.

### 2.3 The keystone

**File:** `supabase/tests/140_patient_safety.sql` — it already owns both error codes, already
builds a PQS-custody event and transfers it to a commission custodian, and its HC044 assertion on
`acknowledge_event` (L145–154) is the exact sibling shape. **Insert before the flag-gate block at
L353**, and bump `select plan(35)` (L17) → `plan(39)`.

**Fixture: hand-roll a dedicated event** (the `352_dispose_event_door_gate.sql:58–80` idiom), *not*
`e1`. `e1` is a live participant in the file's state machine and the allow leg would cancel it out
from under later assertions; a self-contained event also makes the block order-independent.

```sql
create temp table evc on commit drop as select gen_random_uuid() as ev, gen_random_uuid() as ev_final;
grant select on evc to authenticated;

insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status,
   current_owner_kind, current_owner_commission_id, reported_by)
values
  ((select ev from evc),       'EV-C2A', (select comm_x from k), current_date, 'Evento C2 A',
   'acknowledged', 'commission', (select comm_x from k), (select sa_x from k)),
  ((select ev_final from evc), 'EV-C2B', (select comm_x from k), current_date, 'Evento C2 B',
   'cancelled',    'commission', (select comm_x from k), (select sa_x from k));
```

**Personas:**

| leg | persona | why |
| --- | --- | --- |
| deny HC044 | `st_x` (plain `staff` of comm_x) | ⭐ the discriminator. He *is* a member of the reporting commission, so `can_read_event` returns true and he clears the P0002 gate — the refusal is therefore attributable **only** to custody, not to a read denial or to tenancy |
| allow | `sa_x` (`staff_admin` of comm_x) | custodian via the `current_owner_kind='commission'` arm |
| deny HC043 | `sa_x` on `ev_final` | same custodian, already-terminal event |

```sql
-- ── ⭐ THE KEYSTONE (the blind gate) ─────────────────────────────────────────
select test_helpers.claims_for((select st_x from k), false, 'staff');
set local role authenticated;
select throws_ok(
  format('select public.cancel_event(%L::uuid)', (select ev from evc)),
  'HC044',
  'apenas quem detém a custódia do evento pode cancelá-lo',
  '⭐⭐ KEYSTONE: a reporting-commission member who is NOT the custodian CANNOT cancel the event — mutation-proven BLIND 2026-08-31. He clears can_read_event (P0002) and fails ONLY at custody, so the refusal is attributable to the HC044 gate alone');
reset role;

-- ── second anchored raise: the terminal-state guard ──────────────────────────
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select throws_ok(
  format('select public.cancel_event(%L::uuid)', (select ev_final from evc)),
  'HC043', 'este evento já está em um estado final',
  '⭐ the custodian cannot cancel an already-terminal event (HC043) — the door''s SECOND anchored raise, pinned so the mutation cannot survive on either');

-- ── ALLOW-LEG DIFFERENTIAL (and the thing that clears ARM=floor) ─────────────
select lives_ok(
  format('select public.cancel_event(%L::uuid)', (select ev from evc)),
  '⭐ ALLOW-LEG DIFFERENTIAL: the commission custodian IS admitted by the same gate, in the same transaction. Without this leg the deny arms would pass equally well with the flag off, the event absent, or EXECUTE revoked');
reset role;

select is((select status from public.patient_safety_event where id = (select ev from evc)),
  'cancelled',
  '⭐ …and the admitted call really CANCELLED. lives_ok alone is satisfied by a door that returns without doing anything — which is how an allow leg goes vacuous');
```

**Under mutation:** both HC044 and HC043 become `null;` → the first `throws_ok` fails (st_x
succeeds in cancelling) **and** the second fails → RED → COVERED. Pinning both anchored raises
means the verdict cannot survive on a technicality in either branch.

### 2.4 UNVERIFIED

- ⚠ `public.cancel_event` is defined **only** in the baseline and no runtime-rewrite loop was found
  matching it, but this is a *text* conclusion. Confirm the live body and, specifically, that the
  errcodes are still `P0002 / HC044 / HC043` in that order:
  `select pg_get_functiondef('public.cancel_event(uuid)'::regprocedure);`
- ⚠ **Ordering assumption:** the design relies on `can_read_event` being evaluated **before**
  `event_current_custodian`. If the live body reordered them, `st_x` would still fail at HC044 —
  but re-read before trusting the "attributable only to custody" claim.
- ⚠ **The hand-rolled INSERT must actually land.** `patient_safety_event` carries a status guard
  trigger keyed on `app.in_safety_rpc` (L182 of `140` asserts a direct UPDATE raises HC043). A
  plain INSERT as the test's owner role is what `352:74–80` does successfully, but confirm the
  guard is UPDATE-only and that `code`, `discovered_at` and any NOT NULL columns are complete
  against the live table definition.
- ⚠ **Hats:** `st_x` and `sa_x` are single-role in `test_helpers.bootstrap()`, so the 2-arg
  `claims_for` would auto-derive. The explicit third argument above is deliberate belt-and-braces;
  verify the role strings (`'staff'`, `'staff_admin'`) match `authz.roles`.

**Confidence: HIGH** for the mechanism and the HC044 leg; **MEDIUM** for the hand-rolled fixture
landing first try (column completeness + the status guard trigger are the two ways it could need a
tweak).

---

## 3 · `public.cancel_session(p_session_id uuid, p_reason text)` — ⚠ the sharp one

### 3.1 The guards — and the finding that reframes this row

Latest text: `supabase/migrations/20260826000000_audit_payload_free_text_sweep.sql:161` (which
states in its header that bodies were re-emitted from the **live** catalog per ADR 0078 A28 —
superseding `20260720000810_interview_sessions_rpcs.sql:537`).

```sql
perform app.assert_interviews_enabled();
select interview_id, status into v_interview_id, v_status from public.interview_sessions where id = p_session_id;
if v_interview_id is null then
  raise exception 'sessão de entrevista % não encontrada', … using errcode = 'no_data_found';  -- ⛔ NOT anchored
end if;
perform app.assert_interview_writable(v_interview_id);        -- ⛔ a DIFFERENT enforcer (HC039)
if v_status = 'completed' then
  raise exception 'uma sessão concluída não pode ser cancelada'
    using errcode = 'HC038';                                  -- ✅ the ONLY anchored raise
end if;
```

> ⛔ **STRUCTURAL FINDING — the guard the harness neutralized in `cancel_session` is NOT an
> authorization guard.** Its only anchored raise is **HC038**, the *terminal-state* guard. The
> door's authorization lives entirely in `app.assert_interview_writable(uuid)`
> (`20260620000000_baseline.sql:607`), which raises `HC039` from **its own** body — a separate
> row in the neutralizer's worklist that the `cancel_session` mutation does not touch.
>
> **The practical trap:** the obvious remedy — "write an authz keystone: a non-writer calling
> `cancel_session` gets HC039" — would **not flip this verdict**. It would pin
> `assert_interview_writable`, leaving `cancel_session` BLIND, while reading in a commit message
> exactly like a fix. The keystone that moves *this* row must assert **HC038**.
>
> This is the same class as `[[a-predicate-quoted-at-the-wrong-grain]]`: the check runs, it is
> just not checking the thing that was measured.

### 3.2 ⭐ Why the suite is blind to it — the concrete mechanism

`cancel_session` is mentioned by exactly one pgTAP file, `supabase/tests/121_interviews.sql`, at
**L381–382**, and the mention is this:

```sql
select is(has_function_privilege('public',
  'public.cancel_session(uuid,text)', 'execute'), false,
  't19: PUBLIC cannot execute cancel_session');                                                -- 57
```

**The mechanism, named concretely: the sole mention is a `has_function_privilege` catalog-ACL
assertion in the file's t19 REVOKE-guard block. It never invokes the function.**
`has_function_privilege` reads `pg_proc.proacl`; rewriting the function *body*'s raise to `null;`
does not perturb a single bit of the ACL, so the assertion is *structurally incapable* of noticing
the mutation. It is not "the test only covers the happy path" and not "another layer raises the
same code" — it is coverage that never enters the function at all.

That is precisely the `presence of coverage is not a verdict` case, and it is worth generalising:
**every t19 REVOKE-guard block in this suite is grep-visible as "a test mentioning the door" while
being blind to every possible body mutation.** Any future audit that scores coverage by grepping
test files for a door name will be misled the same way, for ~60+ doors.

Two aggravating facts:

- `cancel_session` has **no caller inside the DB either**: `public.cancel_interview` cascades its
  non-terminal sessions to `cancelled` with a **direct UPDATE**, not by calling `cancel_session`
  (`121_interviews.sql:288–292` asserts the cascade). The only real caller is
  `src/lib/interviews/actions.ts`, i.e. E2E-only — which is exactly the justification that put it
  on `authz-neverclled-door-allowlist.txt:74`, and exactly what made it blind.
- The `completed` branch is unreachable through `cancel_interview`'s cascade (which skips terminal
  sessions), so nothing anywhere exercises HC038 on this door.

### 3.3 The keystone

**File:** `supabase/tests/121_interviews.sql` — the deny leg is a **two-line insertion into an
already-perfect fixture**. Bump `select plan(60)` (L16) → `plan(63)`.

**Deny leg — insert immediately after test 27 (after L188).** At that point in the transaction:
`s1` has been completed (L172), interview `i1` is `awaiting_follow_up` (not yet concluded, so no
child-lock freeze), and `sa_x` is already claimed-in and authorized. Every precondition is already
standing — the file already asserts `complete_session` raises HC038 on `s1` on the very previous
line, so this is the same probe pointed at the sibling door:

```sql
select throws_ok(
  $$ select public.cancel_session((select id from s1)) $$,
  'HC038', 'uma sessão concluída não pode ser cancelada',
  '⭐⭐ KEYSTONE: cancel_session on a COMPLETED session raises HC038 — mutation-proven BLIND 2026-08-31 (its ONLY anchored raise; the file''s single prior mention was a has_function_privilege ACL assertion that never enters the function)');
```

**Allow leg — insert in the §"Session RLS write" block, after `s4` is created (after L325) and
before the `no_show_session` call at L336.** `i3` is writable and `sa_x` is a `staff_admin`;
schedule a second session and cancel it:

```sql
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table s5 on commit drop as
  select * from public.schedule_session((select id from i3), null, 'presencial',
                                         now() + interval '2 days', null, null, null);
select public.cancel_session((select id from s5), 'agenda do entrevistado');
reset role;
grant select on s5 to authenticated;

select is((select status from public.interview_sessions where id = (select id from s5)),
  'cancelled',
  '⭐ ALLOW-LEG DIFFERENTIAL: a writer CAN cancel a scheduled session — without it the HC038 arm would pass equally well with the flag off or EXECUTE revoked, and ARM=floor would still see 0 recorded calls');
select is((select cancellation_reason from public.interview_sessions where id = (select id from s5)),
  'agenda do entrevistado',
  'the free-text reason persists on the RLS-scoped, erasable row (ADR 0085 / 20260826000000), never in the un-erasable audit payload');
```

**Under mutation:** HC038 becomes `null;` → `cancel_session` on completed `s1` succeeds and flips
it to `cancelled` → `throws_ok` fails → RED → COVERED. (The allow leg passes either way; it exists
for the floor arm and for the differential, not for the verdict.)

### 3.4 ⚠ Adjacent, unmeasured, structurally identical: `public.no_show_session`

`no_show_session(p_session_id uuid, p_reason text)` is `cancel_session`'s exact twin — same
prologue, same delegate, same single anchored raise (HC038, *"não pode ser marcada como não
comparecimento"*, `20260826000000:219`). It **is** invoked by `121_interviews.sql:336`, but **only
on the happy path** (a `scheduled` session → `no_show`), so its HC038 branch is equally unpinned.
It has not been measured — it is one of the 163 unswept enforcers. A one-line `throws_ok` on `s1`
alongside the `cancel_session` deny leg pre-empts a near-certain fourth BLIND at ~zero cost.
**Flagged, not assumed:** predict, then measure with `CASES=public.no_show_session`.

### 3.5 UNVERIFIED

- ⚠ **Is `20260826000000` the live body?** It is the latest migration mentioning `cancel_session`,
  and it declares itself authored from `pg_get_functiondef`. No later catalog-rewrite loop was
  found matching it (`20260917000200` filters on `is_commission_admin_of`; `20260918001000` and
  `20261003007210/7220/7200` name their targets explicitly; none include it). Confirm:
  `select pg_get_functiondef('public.cancel_session(uuid,text)'::regprocedure);`
  — and specifically confirm **HC038 is still the only `42501|HC0xx` raise in the body**. If a
  later change added a `42501`, this design would pin only half the mutation.
- ⚠ **`app.assert_interview_writable` is its own worklist row and is UNMEASURED.** Its anchored
  raise is HC039 and `121_interviews.sql:329–331` pins HC039 on `schedule_session`, so it is
  *likely* COVERED — but likely is not a verdict. Confirm with
  `CASES=app.assert_interview_writable` once the DB is free. ⛔ Do not let its (probable) coverage
  be read as coverage of `cancel_session`; they are different rows.
- ⚠ The Portuguese message strings are taken from migration text and must match the live body
  byte-for-byte, or `throws_ok`'s message argument will fail for the wrong reason.

**Confidence: VERY HIGH** on the mechanism of blindness (the ACL assertion is directly quoted and
unambiguous) and on the deny leg — it drops into a fixture that is already in exactly the right
state. **HIGH** on the allow leg (depends on `i3` still being writable at that point, which
L300–332 establishes).

---

## 4 · Cross-cutting notes for whoever implements this

### 4.1 Order of operations

1. **Verify the three live bodies** against `pg_get_functiondef` (§1.4 / §2.4 / §3.5) — one of the
   three is *known* stale and the other two are only *presumed* current.
2. Write the three keystones. ⛔ **They change the suite's shape** (`Tests=8289` → ~8300). The C2
   harness compares every mutated run's shape against a baseline captured at the top of its run,
   so this is harmless *between* runs but **voids an in-flight sweep** — hence design-only today.
3. **Delete `authz-neverclled-door-allowlist.txt` lines 73, 74 and 99 in the same commit** (the
   file's own retirement protocol, L33–34). The allow legs are what make this legal; without them
   `ARM=floor` still sees 0 recorded calls and will red.
4. Re-run `CASES="public.nsp_org_capa_rollup public.cancel_event public.cancel_session"` to confirm
   BLIND → COVERED (a subset run writes to `$WORK`, ADR 0153 — merge the rows into
   `docs/reviews/c2-command-door-findings.md`, never copy the file over the baseline).
5. Phase-gate arms that must follow: `ARM=census`, `ARM=floor` (its offender list changes),
   `ARM=hat`, `FROMFINDINGS=1 ARM=wrapper`.

### 4.2 Repo idioms these designs follow

- **Claims:** `test_helpers.claims_for(p_user uuid, p_is_admin boolean default false,
  p_active_role text default null)` (`supabase/tests/00_setup.sql:404`). It is `SECURITY DEFINER`
  so it works after `set local role authenticated`. ⛔ **It mints NO `active_role` key when the
  principal has 0 or ≥2 live roles** — a hatless principal fails every `app.has_role` check
  closed, which reads as an authorization finding and is actually a fixture bug. `claims_for(u,
  true)` on a principal that also holds one membership yields **two** roles and therefore **no
  hat** (which is why `140:170` writes `claims_for(admin, true, 'pqs_member')`). **Pass the hat
  explicitly in every leg above.**
- **Scaffolding triple:** `select test_helpers.claims_for(…); set local role authenticated; … reset role;`
- **`format(…, %L::uuid, …)` vs `$$ … $$`:** both are live. Use `format()` when the temp table is
  not visible from inside the `throws_ok` string under the assumed role (`352`'s reason); `$$ … $$`
  with a correlated subselect is fine where the file already grants `select` on the temp table to
  `authenticated` (which `121` and `140` both do).
- **Pin the message, not just the code** (`352:97`): a bare `42501` is also what a missing EXECUTE
  grant raises.
- **Allow leg + effect assertion are mandatory** (`352:109–125`): a refusal is evidence only when
  the door demonstrably admits someone, and `lives_ok` alone is satisfied by a door that returns
  without doing anything.
- **In-place vs a new numbered file.** All three go **in place** (189 §9, 140, 121) because each
  has a natural home with a live fixture already in the required state; a dedicated
  `412_c2_blind_command_door_keystones.sql` would have to rebuild three unrelated fixtures. The
  `352` precedent (a standalone file) applies to a door with no such home. Provenance is preserved
  by carrying *"mutation-proven BLIND 2026-08-31"* in each test's description string.
- ⚠ **Filename to re-check:** the `has_role` hat condition was reported at
  `supabase/migrations/20260918002200_act_stage3_is_admin_hat_condition.sql:145`. That path was
  read once and should be re-confirmed; the *content* (the trailing
  `and (p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role())`)
  is what matters and is corroborated by `315_act_stage3_hat_condition.sql` and
  `316_act_p0_caller_gate_sweep.sql`.

### 4.3 The generalisable lesson

Two distinct blindness shapes were found, and only one of them is the familiar one:

| shape | doors | why coverage-by-grep misses it |
| --- | --- | --- |
| **no mention at all** | `nsp_org_capa_rollup`, `cancel_event` | grep finds 0 files — honest, and detectable by the existing derivation |
| **mentioned, never entered** | `cancel_session` | grep finds 1 file and reads as covered; the mention is a `has_function_privilege` catalog assertion that cannot observe any body change |

The second shape is the reusable warning: **a t19 REVOKE-guard block makes a door grep-positive
while leaving it mutation-blind.** ~60 doors in this suite have exactly that profile. Any future
"which doors have coverage?" question answered by grepping test files for a door name will
overcount by that set — the enumeration is bounded by a *syntax* (the name appearing) rather than
a *property* (the function being entered), which is this phase's dominant failure class.
