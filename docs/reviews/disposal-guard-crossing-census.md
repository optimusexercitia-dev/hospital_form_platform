# Disposal-door × raising-trigger crossing census

**Measured 2026-08-20 from the live catalog** (`pg_proc.prosrc`, `pg_trigger`, `pg_constraint`)
on a local stack at migration `20261003000100`. Produced for
`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW` / ADR
[0129](../decisions/0129-meeting-child-lock-disposal-flag.md) Amendment 2, which asked for the
remaining guard population to be derived **as a property**, not as a hand list.

> ⛔ **A candidate count is not a defect count — and an unproven row is not a clean row.**
> Every row below carries a verdict. The three verdict classes must sum to the total; they do
> (14 + 9 + 28 = 51).

---

## 1. The property, and how it was bounded

**The property:** *a row-level trigger that can `raise exception` on a table one of the four
`dispose_*` doors writes, with a TG_OP mask that intersects the door's own verb on that table.*

Neither half was taken from a document:

- **Write set** — derived by regex over `pg_proc.prosrc` of the four doors **with `--` comments
  stripped first**, so the pattern cannot match commentary (`prosrc` includes comments; a regex
  matching one has already produced a false finding in this repo). The derivation returned **40
  (door, table) pairs**, and it was cross-checked against a hand read of all four door bodies —
  they match exactly, which is what licenses the regex.
- **Trigger set** — `pg_trigger` where `not tgisinternal`, joined to `pg_proc`, filtered to
  bodies containing `raise exception` (again comment-stripped). The TG_OP mask is read from
  `tgtype`'s bits (4 INSERT / 8 DELETE / 16 UPDATE), never from the trigger's name.
- **Closure over cascades** — the four DELETE targets were followed through
  `pg_constraint.confdeltype = 'c'` to their cascade children, and those children's DELETE-masked
  raising triggers added. This is the step a table-level enumeration misses: `delete from
  public.answers` fires guards on three tables the door never names.

**Result: 48 direct crossings + 3 cascade crossings = 51.**

> ⚠ **ADR 0129 Amendment 2 recorded "15 candidates, 3 confirmed". Both figures were bounded to
> `dispose_event_phi` + `dispose_case_phi`.** Swept across all four doors and closed over
> cascades the population is **51**, and the confirmed child-lock set is **10 statements across
> 4 guards**, not 9 across 3 — the tenth (`dispose_case_phi` → `meeting_cases`) appeared in no
> filed record at all. Recorded here because a magnitude that is corrected only in a report is
> corrected nowhere.

Reproduce with the query in §5.

---

## 2. Verdict summary

| verdict | rows | meaning |
|---|---:|---|
| **CONFIRMED-reachable** | **14** | the door's own write can reach the raise. 10 were the defect (fixed by `20261003000000`); 4 are BY DESIGN. |
| **STRUCTURALLY-UNREACHABLE** | **9** | the trigger's TG_OP mask does not intersect the door's verb on that table. Named by mask bit. |
| **NON-BLOCKING** | **28** | the guard runs and cannot raise on this door's write — either the door already sets the GUC the guard reads, or the guard re-validates columns the door does not change. |
| **total** | **51** | |

---

## 3. CONFIRMED-reachable (14) — every one EXECUTED, not reasoned

### 3a. The child-lock defect — 10 statements, 4 guards (FIXED by `20261003000000`)

| # | door | table | guard | raises | status |
|---|---|---|---|---|---|
| 1 | `dispose_event_phi` | `rca_factors` | `app.guard_rca_child_lock` | HC047 | fixed · pinned `353` t5/t6 |
| 2 | `dispose_event_phi` | `rca_root_causes` | `app.guard_rca_child_lock` | HC047 | fixed · `353` t9 |
| 3 | `dispose_event_phi` | `rca_timeline_entries` | `app.guard_rca_child_lock` | HC047 | fixed · `353` t9 |
| 4 | `dispose_event_phi` | `rca_evidence` | `app.guard_rca_child_lock` | HC047 | fixed · `353` t9 |
| 5 | `dispose_event_phi` | `rca_why_chains` | `app.guard_rca_child_lock` | HC047 | fixed · `353` t9 |
| 6 | `dispose_event_phi` | `capa_effectiveness` | `app.guard_capa_child_lock` | HC049 | fixed · `353` t18/t19 |
| 7 | `dispose_event_phi` | `capa_measure_result` | `app.guard_capa_child_lock` | HC049 | fixed · `353` t22 |
| 8 | `dispose_event_phi` | `capa_action_task` | `app.guard_capa_child_lock` | HC049 | fixed · `353` t22 |
| 9 | `dispose_case_phi` | `case_interview_subjects` | `app.guard_interview_child_lock` | 23514 | fixed · `353` t35/t36 |
| 10 | `dispose_case_phi` | `meeting_cases` | `app.guard_meeting_child_lock` | 23514 | fixed · `353` t52/t53 |

**Executed, not inferred.** Suite `353` constructs a locked/terminal parent WITH children for
each lane and drives the real door end-to-end; mutation-proving each guard's stand-aside away
turns the lane's keystone RED (M1 → t5-7,9 · M2 → t18-20,22,29-30 · M3 → t35-37,39,46-47 ·
M4 → t52-54). Row 10 needed no guard change — the guard has read `app.in_disposal_rpc` since
ADR 0129; the door simply never set it.

### 3b. Legal hold — 4 rows, BY DESIGN (no fix owed)

| door | table | guard | raises |
|---|---|---|---|
| `dispose_case_phi` | `file_objects` | `app.guard_file_object_transition` | HC0D3 |
| `dispose_case_phi` | `documents` | `app.guard_document_transition` | HC0D3 |
| `dispose_referral_phi` | `file_objects` | `app.guard_file_object_transition` | HC0D3 |
| `dispose_referral_phi` | `documents` | `app.guard_document_transition` | HC0D3 |

**Constructed and executed** (case-homed document, PHI-tier file object, one unreleased
`document_legal_holds` row), with the matched positive control:

```
PROBE-1  no hold   -> door COMPLETED (no raise);  patient_identifiers = 0
PROBE-2  hold live -> SQLSTATE=HC0D3 "descarte bloqueado por retenção legal ativa"
                                              ;  patient_identifiers = 1
```

⚠ **The failure SHAPE is identical to the child-lock bug** — the raise aborts the RPC and the
Class-1 PHI DELETE that ran first is rolled back, so nothing is erased. **The INTENT is the
opposite.** A legal hold is a live retention obligation that outranks an LGPD Art. 18 erasure;
refusing is the correct answer. `dispose_referral_phi` already documents this in its body
(*"Blocked by an active legal hold (HC0D3) BY DESIGN — D10's rule"*); `dispose_case_phi` did
not, and migration `20261003000000` adds the same statement to its `(f)` block. That asymmetry
— one door documenting a behaviour its sibling shares in silence — is exactly how the
child-lock defect stayed invisible for a month.

**Is a pin owed?** The *guard* arm is already pinned three times (`328` :363/:369, `329` H3/H4,
`312` :530). What is **not** pinned is that the refusal propagates to a whole-door abort with
PHI surviving. That is a real, unpinned, deliberate behaviour, and it is not this round's
subject — filed as a follow-up rather than added here, because a pin asserting "erasure is
refused" needs a PO reading first: it encodes a policy (hold beats Art. 18), not a mechanism,
and a test that freezes a policy nobody has re-affirmed is worse than none.

---

## 4. STRUCTURALLY-UNREACHABLE (9) — named by the mask bit that proves it

| door | table (door's verb) | trigger | trigger mask | why unreachable |
|---|---|---|---|---|
| `dispose_case_phi` | `answers` (DELETE) | `reject_answer_on_display_item` | INSERT+UPDATE | no DELETE bit (8) |
| `dispose_case_phi` | `case_interviews` (UPDATE) | `app.ensure_securable_resource` | INSERT | no UPDATE bit (16) |
| `dispose_case_phi` | `cases` (UPDATE) | `app.ensure_securable_resource` | INSERT | no UPDATE bit (16) |
| `dispose_event_phi` | `rca` (UPDATE) | `app.ensure_securable_resource_rca` | INSERT | no UPDATE bit (16) |
| `dispose_meeting_minutes` | `meeting_attendees` (UPDATE) | `app.trg_attendee_roster` | DELETE | no UPDATE bit (16) |
| `dispose_meeting_minutes` | `meetings` (UPDATE) | `app.guard_meeting_active_print` | DELETE | no UPDATE bit (16) |
| `dispose_meeting_minutes` | `meetings` (UPDATE) | `app.ensure_securable_resource` | INSERT | no UPDATE bit (16) |
| `dispose_referral_phi` | `case_referral` (UPDATE) | `app.ensure_securable_resource_referral` | INSERT | no UPDATE bit (16) |
| `dispose_referral_phi` | `referral_messages` (UPDATE) | `app.guard_referral_message` | INSERT | no UPDATE bit (16) |

⚠ "Unreachable" here is scoped to **this door's verb on this table today**. Widening a door from
UPDATE to DELETE on any of these tables re-opens the row; the mask is the proof, so re-run §5
after any change to a door's write set.

---

## 5. NON-BLOCKING (28)

### 5a. The door already sets the GUC the guard reads (13 + 3 cascade = 16)

| door | table | guard | GUC it reads | set by the door |
|---|---|---|---|---|
| `dispose_case_phi` | `answers` | `guard_submitted_children` | `app.in_submit_rpc` | ✅ |
| `dispose_case_phi` | `answer_selected_options` *(cascade)* | `app.guard_submitted_selections` | `app.in_submit_rpc` | ✅ |
| `dispose_case_phi` | `answer_matrix_cells` *(cascade)* | `app.guard_submitted_selections` | `app.in_submit_rpc` | ✅ |
| `dispose_case_phi` | `answer_risk_matrix` *(cascade)* | `app.guard_submitted_selections` | `app.in_submit_rpc` | ✅ |
| `dispose_case_phi` | `case_interviews` | `app.guard_interview_status` | `app.in_interview_rpc` | ✅ |
| `dispose_case_phi` | `case_narratives` | `app.guard_case_narrative_frozen` | `app.in_narrative_rpc` | ✅ |
| `dispose_case_phi` | `cases` | `app.guard_case_status` | `app.in_case_rpc` | ✅ |
| `dispose_case_phi` | `cases` | `app.guard_case_visibility` | `app.in_case_rpc` | ✅ |
| `dispose_event_phi` | `capa_plan` | `app.guard_capa_status` | `app.in_safety_rpc` | ✅ |
| `dispose_event_phi` | `event_triage` | `app.guard_event_triage` | `app.in_safety_rpc` | ✅ |
| `dispose_event_phi` | `patient_safety_event` | `app.guard_event_status` | `app.in_safety_rpc` | ✅ |
| `dispose_event_phi` | `rca` | `app.guard_rca_status` | `app.in_safety_rpc` | ✅ |
| `dispose_meeting_minutes` | `meetings` | `app.guard_meeting_status` | `app.in_meeting_rpc` | ✅ |
| `dispose_referral_phi` | `case_referral` | `app.guard_referral_status` | `app.in_referral_rpc` | ✅ |
| `dispose_referral_phi` | `referral_reply` | `app.guard_referral_reply_lock` | `app.in_referral_rpc` | ✅ |
| `dispose_referral_phi` | `referral_shared_item` | `app.guard_referral_snapshot_lock` | `app.in_referral_rpc` | ✅ |

Each is also **behaviourally confirmed**: every one of these statements sits BEFORE the first
child-lock raise in its door's statement order, so the pre-fix failure reports prove the door
reached them.

### 5b. Already covered by the meeting-lane fix (4)

`dispose_meeting_minutes` × `meeting_agenda_items` / `meeting_attendees` /
`meeting_closed_sessions` (`app.guard_meeting_child_lock`) and × `meeting_closed_session_items`
(`app.guard_reserved_child_lock`) — both guards read `app.in_disposal_rpc`, which this door
sets. ADR 0129 + Amendment 1; pinned by suites `348` and `351`.

### 5c. Coherence checks over columns the door does not change (8)

| door | table | guard | what it re-validates |
|---|---|---|---|
| `dispose_case_phi` | `case_interviews` | `app.guard_interview_links` | `commission_id` vs case, `case_phase_id` vs case |
| `dispose_case_phi` | `case_narratives` | `app.guard_case_narrative_type_coherent` | `narrative_type_id`'s commission |
| `dispose_case_phi` | `case_participants` | `app.assert_participant_same_org_as_case` | participant org vs case org |
| `dispose_case_phi` | `cases` | `app.guard_case_outcome_coherent` | `outcome_id`'s commission (+ an offered-set arm gated on `app.is_client_role()`, and this door is `SECURITY DEFINER`) |
| `dispose_case_phi` | `cases` | `app.guard_case_org_matches_commission` | `organization_id` vs commission's org |
| `dispose_case_phi` | `meeting_cases` | `app.guard_meeting_cases` | meeting/case commission match, `agenda_item_id`'s meeting |
| `dispose_case_phi` | `documents` | `app.guard_document_confidentiality` | restricted `confidentiality_level` ⇒ home is case/interview |
| `dispose_referral_phi` | `documents` | `app.guard_document_confidentiality` | same |

The argument is the same in each case and it is **structural, not statistical**: every one of
these triggers fires on **INSERT as well as UPDATE**, so the state it forbids cannot be
constructed through any path; and the door changes none of the columns the predicate reads. A
row that would raise here could never have been inserted.

⚠ **One deserves naming**, because it is the only row where the predicate is not trivially
self-satisfied: `app.guard_document_confidentiality` refuses a `legal_privileged` /
`credentialing_sensitive` document whose home resource is not a `case` or `interview` — so a
**referral-homed** document at one of those levels would abort `dispose_referral_phi`. It is
unconstructible for the reason above (the same trigger guards the INSERT), and it is listed
here rather than silently folded in, because if a backfill or an `ALTER` ever admits that
corner, this is the row that goes live.

---

## 6. Reproduce

```sql
-- write set x raising row-level triggers, with the TG_OP mask verdict
with doors as (
  select p.proname, regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in
    ('dispose_event_phi','dispose_case_phi','dispose_referral_phi','dispose_meeting_minutes')
),
writes as (
  select d.proname as door,
         case when lower((m)[2]) like 'delete%' then 'DELETE'
              when lower((m)[2]) like 'insert%' then 'INSERT' else 'UPDATE' end as verb,
         lower(replace((m)[3], 'public.', '')) as tbl
  from doors d, lateral regexp_matches(d.src,
    '(^|[^a-z_])(update|delete\s+from|insert\s+into)\s+(public\.[a-z_]+|[a-z_]+)', 'gi') as m
),
rels as (
  select w.door, w.tbl, string_agg(distinct w.verb, '+' order by w.verb) as door_ops, c.oid as reloid
  from (select distinct door, tbl, verb from writes) w
  join pg_class c on c.relname = w.tbl
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' group by w.door, w.tbl, c.oid
)
select r.door, r.tbl, r.door_ops, t.tgname, tf.oid::regprocedure::text as fn,
  concat_ws('+', case when (t.tgtype& 4)= 4 then 'INSERT' end,
                 case when (t.tgtype& 8)= 8 then 'DELETE' end,
                 case when (t.tgtype&16)=16 then 'UPDATE' end) as trg_ops,
  case when not (
        (r.door_ops like '%UPDATE%' and (t.tgtype&16)=16)
     or (r.door_ops like '%DELETE%' and (t.tgtype& 8)= 8)
     or (r.door_ops like '%INSERT%' and (t.tgtype& 4)= 4))
       then 'MASK-DISJOINT' else 'IN-MASK' end as mask_verdict,
  coalesce((select string_agg(distinct g[1], ',')
            from regexp_matches(regexp_replace(tf.prosrc,'--[^\n]*','','g'),
                                'app\.in_[a-z_]+_rpc','g') g), '(none)') as reads_guc
from rels r
join pg_trigger t on t.tgrelid = r.reloid and not t.tgisinternal
join pg_proc tf on tf.oid = t.tgfoid
where regexp_replace(tf.prosrc,'--[^\n]*','','g') ~* 'raise\s+exception'
order by mask_verdict, r.door, r.tbl, t.tgname;
```

Cascade closure (the step a table-level sweep misses):

```sql
with tgt(t) as (values ('answers'),('patient_identifiers'),('event_patient'),('referral_patient'))
select con.confrelid::regclass::text as parent, con.conrelid::regclass::text as child,
       con.confdeltype,
       (select string_agg(t.tgname||' -> '||tf.oid::regprocedure::text, '; ')
          from pg_trigger t join pg_proc tf on tf.oid = t.tgfoid
         where t.tgrelid = con.conrelid and not t.tgisinternal and (t.tgtype & 8) = 8
           and regexp_replace(tf.prosrc,'--[^\n]*','','g') ~* 'raise\s+exception') as raising
from pg_constraint con join tgt on con.confrelid = ('public.'||tgt.t)::regclass
where con.contype = 'f' order by 1,2;
```

**Re-run this after any change to a `dispose_*` door's write set, or after adding any row-level
trigger to a table in one.** The mask verdicts in §4 are the part that silently goes stale.
