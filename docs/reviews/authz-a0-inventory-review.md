# QA review — Stage A0 catalog-driven inventory (ADR 0078)

> ## 📌 FINAL VERDICT — **v3: ✅ APPROVED · A0 is CLOSED** → [jump to the v3 review](#v3-review--the-final-a0-round)
>
> **A0 v3 is sufficient to author M1·1–M1·4's SQL against.** M1·5 (A30) is blocked on an exhaustive
> platform_admin enumeration — last in A29's sequence, so it does not gate the rest.
> **→ [The authoritative, ordered M1 scope is §W-6](#w-6--the-authoritative-ordered-m1-scope--backend-builds-from-this) — `backend` builds from that list, not from §6.**
>
> **Round history — every round found a real P0, and the reviewer was wrong in the last two:**
> | Round | Verdict | What it turned on |
> |---|---|---|
> | **v1** (Part I) | ⛔ CHANGES REQUESTED | fix set 13/15 → 30; the respondent arm's mutators. ⚠ **Contains 3 errors** — corrected in §V-0 and §W-0. |
> | **v2** (Part II) | ⛔ CHANGES REQUESTED | `case_participant_roles` = the 6th exclusion-plane table. ⚠ **Its PHI claim was over-stated** — corrected in §W-0.1. |
> | **v3** (Part III) | ✅ **APPROVED** | the **gate-helper frame** ends the five-round floor regress — and it is **provably closed** (§W-2.3). |
>
> Parts I and II are retained for provenance only. **Read Part III.**

---

# PART I — v1 review (2026-07-15) · ⚠ SUPERSEDED, contains 3 disproved claims

**Date:** 2026-07-15 · **Reviewer:** `qa` · **Subject:** `docs/progress/authz-capability-inventory.md`
**Method:** live catalog only (`pg_proc.prosecdef` / `prosrc`, `pg_policies`, `pg_constraint`,
`pg_class`, `information_schema`), local Docker stack, branch `feat/authorization-capability-model`.
No migration file was read. One live probe, run in a transaction and `ROLLBACK`ed; persistence
re-verified afterward (§NEW-1).

> ⚠ **Three claims in Part I are WRONG. See §V-0.** (1) §7's fixture is **not** "seeded and ready" —
> the seeded respondent is plain `staff` and the gate **correctly denies him**; the exploit needs
> **respondent AND `staff_admin`**. (2) §6·1's fix set of **30** is itself a **floor** — it inherited
> the `is_commission_admin_of` filter this very review told `backend` to abandon. The real figures are
> **population 49 / fix set 35**. (3) §NEW-2's `readgate=t` for `set_participant_patient` is a
> **false positive from a code comment** — it has no read gate (§V-0.3).

---

# VERDICT (v1, superseded): ⛔ **CHANGES REQUESTED**

**This is a strong deliverable and its three headline findings are all real.** Every one of the
inventory's claims that I tested reproduced exactly against the catalog, including the reproducibility
counts. The author found three P0/P1 defects that the ADR, the plan, and the entire test plan missed.

It is nonetheless **not yet a sufficient foundation to author SQL against**, for one structural reason:

> **The inventory's remediation set is under-scoped by its own logic.** It proves that
> `is_staff_admin_of` survives unqualified after the admin arm is removed (it says so itself, for
> `action_items`/A22) — and then files **10 DEFINER RPCs with exactly that shape** under
> "REMOVE-ARM only", leaving them unfixed. The real DEFINER-without-exclusion count is **30**, not the
> **13** claimed (a header whose own list has **15** entries).

Plus one **new P0 the inventory missed**, which I proved live: the exclusion model has **three**
self-serving mutators, not one. `lift_recusal` is the recusal arm. The **respondent** arm has two more,
and one of them opens **PHI**.

A0 is ~85% of the way there. The corrections below are mechanical, not a redesign. **Re-review should
be fast.**

---

# 1 · Verification of the three NEW findings

## 1.1 · §1.1 `lift_recusal` — ✅ **CONFIRMED** (verbatim)

`prosecdef = t`; the entire gate is exactly as quoted, with no self-vs-other term and no exclusion term:

```
if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
  raise exception 'apenas a coordenação pode suspender recusas deste caso' using errcode = 'HC0E4';
```

**"`record_recusal` is correctly split" — ✅ CONFIRMED.** It genuinely does split self from other:

```
if p_user_id = auth.uid() then      v_source := 'self';
elsif v_is_coord then               v_source := 'coordinator';
else raise exception 'apenas a coordenação pode registrar recusas deste caso' using errcode='HC0E4';
```

**But the inventory's framing of this as a lone asymmetry is wrong — see NEW-1.** `record_recusal`
also **lacks the exclusion term** (`prosecdef=t`, no `is_case_excluded`), so a **recused coordinator
may still record a recusal against another member of the case she is recused from** — i.e. she may
reshape the panel. That is A18's exact concern and the inventory does not list `record_recusal` in its
fix set.

## 1.2 · §1.2 exclusion gate missing from case RPCs — ✅ **CONFIRMED, but the counts are wrong and the fix set is under-scoped**

Re-running Q7 verbatim returns **37 rows**. The partition:

| Bucket | Catalog |
|---|---|
| Total | **37** ✅ matches |
| Lacking the exclusion gate | **34** ✅ matches |
| **DEFINER lacking the gate** | **30** ❌ inventory says **13**; its own list has **15** |
| DEFINER **with** the gate | 3 — `delete_ad_hoc_case_narrative`, `delete_ad_hoc_case_phase`, `list_my_cases` |
| INVOKER | 4 |

### The load-bearing negative — ✅ **CONFIRMED**

The claim the sweep rests on is **correct**. Verified per-RPC from `prosecdef`:

```
 cancel_case                    | f | f
 close_case                     | f | f
 set_case_outcome               | f | f
 update_case_narrative_body     | f | f
```

All four are **INVOKER**, so `cases_staff_admin_write`'s exclusion term does protect them. **The
"do not fix these" instruction is right and must be preserved** — sweeping them would be over-reach.

### ⛔ The under-scope — this is the blocking item

The inventory's own §3.6 "Remaining, REMOVE-ARM per A21·1" bucket contains **10 RPCs that are
`SECURITY DEFINER`, gate on a bare role check, and have no exclusion gate, no `can_read_case`, and no
`can_write_case_content`** — structurally identical to the §1.2 set, but prescribed only "remove the
`is_commission_admin_of` arm":

```
proname                        | definer | excl | can_read_case | can_write_case_content
conclude_meeting               |    t    |  f   |      f        |          f
conclude_narrative             |    t    |  f   |      f        |          f
create_case_from_template      |    t    |  f   |      f        |          f
create_referral_draft          |    t    |  f   |      f        |          f
grant_member_capability        |    t    |  f   |      f        |          f
list_case_access               |    t    |  f   |      f        |          f
reopen_narrative               |    t    |  f   |      f        |          f
set_case_phase_result_override |    t    |  f   |      f        |          f
unassign_narrative             |    t    |  f   |      f        |          f
update_case_meta               |    t    |  f   |      f        |          f
```

Body of `conclude_narrative` (DEFINER), decisive:

```
-- The assignee OR a coordinator/admin may conclude.
if not (v_assigned = auth.uid()
        or app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
  raise exception 'sem permissão' using errcode = '42501';
end if;
```

Remove `is_commission_admin_of` per A21·1 and **`is_staff_admin_of` survives unqualified** → a
**recused coordinator still concludes/reopens/unassigns narratives, overrides phase results, updates
case meta, drafts referrals from the case, and concludes the meeting** on the case she is recused from.

**This is verbatim the reasoning the inventory itself applies to `action_items_staff_admin_write`
(A22).** It applied it to the policy layer and not to its own RPC list. **The fix set is 30, not 15.**

## 1.3 · §1.3 `list_cases_board` fast-path — ✅ **CONFIRMED** (verbatim)

```
v_is_coordinator boolean :=
  app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id);
...
where c.commission_id = p_commission_id
  and (v_is_coordinator or app.can_read_case(c.id, v_uid))
```

The comment says *"sees the whole board without a per-row read check"*. Both consequences hold:
a **recused coordinator** sees her own case; an **`org_admin`/`hospital_admin`** sees the whole board.
The projection is not a thin overview — it returns `case_number`, `label`, `status`, `outcome`, and a
`phases` aggregate with **titles, assignees, due dates and results**, plus open-narrative counts. That
is Case Content.

**Stage A's exit criterion "Organization Users cannot read Case Content" is FALSE and would test
green** against `can_read_case` and against the eight `FOR ALL` policies. ✅ CONFIRMED.

`case_viewer_capabilities` ✅ CONFIRMED — `can_manage_lifecycle` is a bare
`is_staff_admin_of_for OR is_commission_admin_of_for` with no exclusion.

### Hunt for other fast-path RPCs — ✅ one more found, and it is invisible to Q7

**`count_open_cases_for_board`** — the keyset-pagination companion to `list_cases_board` (Wave-2
perf sweep), named in **no** document:

```
if not app.is_staff_admin_of(p_commission_id) then return 0; end if;
return (select count(*)::int from public.cases c
        where c.commission_id = p_commission_id and c.status not in ('completed','cancelled'));
```

DEFINER, bare role, no exclusion, no read check. Low severity (PHI-free integer), **but see NEW-2 —
it is the proof that Q7 has a hole.**

---

# 2 · Verification of the MOVED / FALSE claims

| Claim | Verdict | Decisive catalog evidence |
|---|---|---|
| **Eight `FOR ALL` case policies → actually eleven** (interview family) | ✅ **CONFIRMED** | Q1 returns 23 rows. The 8 (`cases`, `case_narratives`, `case_phases`, `case_events`, `case_offered_outcomes`, `case_tag_assignments`, `case_phase_allowed_results`, `case_phase_offered_results`) **+ 3** interview (`case_interview_interviewers_write`, `case_interview_links_write`, `case_interview_subjects_write`) = **11**. All three interview policies OR `app.is_commission_admin_of(app.commission_of_interview(...))` and **do** carry `AND NOT app.is_case_excluded(app.case_of_interview(...))`. |
| **`case_interviews_update`/`_delete` OR the admin arm with no exclusion** | ✅ **CONFIRMED** | `(app.can_write_interview(id, auth.uid()) OR app.is_commission_admin_of(app.commission_of_interview(id)))` — no exclusion term, on both. |
| **`interview-attachments` bucket gated `is_member_of`** | ✅ **CONFIRMED — real PHI exposure** | See §2.1. |
| **`case_documents_select_member` member-wide** | ✅ **CONFIRMED** | `bucket_id='case-documents' AND (is_commission_admin_of(foldername[1]) OR is_member_of(foldername[1]) OR can_read_snapshot_document(name, auth.uid()))` |
| **`member_can`: 8 sites, 5 on cases** | ✅ **CONFIRMED** | Q6 returns exactly: policy `meetings_staff_admin_write`; fns `create_meeting`, `create_case`, `update_case_meta`, `create_case_from_template`, `activate_phase`, `reassign_phase`, `list_signoff_queue`, `get_response_for_signoff`. |
| **`assign_case_phases` → delegate → PHI** | ✅ **CONFIRMED end-to-end** | See §2.2. |
| **Two `case_access` couplings, not one** | ✅ **CONFIRMED** | See §2.3. |
| **24 `case_access` dependent functions** | ✅ **CONFIRMED** | Q4 → `24`. |
| **A20 unimplementable; linkage write-once; 4 fns not 2; FK `ON DELETE SET NULL`** | ✅ **CONFIRMED** | See §2.4. |
| **Plan A3 already built; `create_case` ignores the type default; nothing writes `visibility_policy` post-creation** | ✅ **CONFIRMED** | See §2.5. |
| **`action_items_staff_admin_write` unfixed by `4f23558` (A22)** | ✅ **CONFIRMED** | `ALL :: (app.is_staff_admin_of(commission_id) OR app.is_commission_admin_of(commission_id))` — no case term, no exclusion term. |
| **`meetings_staff_admin_write` is `FOR ALL` + the `member_can` third arm (A2·1)** | ✅ **CONFIRMED** | `ALL :: (is_staff_admin_of(commission_id) OR is_commission_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))` |
| **`meeting_agenda_items`/`meeting_attendees` `FOR ALL`, no case predicate** | ✅ **CONFIRMED** | Q1. |
| **`meeting_cases_staff_admin_write` carries a case predicate** | ✅ **CONFIRMED** | `... AND app.can_read_case_or_admin(case_id, auth.uid())` |
| **No function writes `max_confidentiality`; both refs are readers (A19)** | ✅ **CONFIRMED** | Q9 → `app.attachment_confidentiality_ok`, `app.confidentiality_clearance_ok`. Both read. |
| **`dispose_meeting_minutes` `returns void` (KEEP)** | ✅ **CONFIRMED** | `result = void`, `prosecdef = t`. |
| **`can_read_case_patient` has no commission-admin arm** | ✅ **CONFIRMED** | Body carries `is_staff_admin_of_for` + raw `case_access`/`case_phases`/`case_narratives` arms only. |
| **`case_recusals_select` OR-s a bare `is_staff_admin_of_for` after a correct deny** | ✅ **CONFIRMED** | `(app.can_read_case(case_id, auth.uid()) OR (user_id = auth.uid()) OR app.is_staff_admin_of_for(app.commission_of_case(case_id), auth.uid()))` |
| **`case_types*` ride `is_admin()`/`is_org_admin_of`, out of scope** | ✅ **CONFIRMED** | `case_types_admin_write :: ALL :: (app.is_admin() OR app.is_org_admin_of(organization_id))` |
| **Blast radius 93 policies / 121 functions / 110 migrations** | ✅ **CONFIRMED** | See §4. |

## 2.1 · The `interview-attachments` bucket — blast radius

```
interview_attachments_obj_select_member :: SELECT ::
  (bucket_id = 'interview-attachments'
   AND (app.is_commission_admin_of((storage.foldername(name))[1]::uuid)
        OR app.is_member_of((storage.foldername(name))[1]::uuid)))
```

**Confirmed exactly as reported.** The key is `foldername[1] = commission_id` — **commission-scoped,
not case-scoped**. It therefore bypasses, simultaneously:

- `app.can_read_attachment` (whose `'interview'` arm is case-scoped, "a deliberate PHI tightening, Rule 12");
- `app.attachment_confidentiality_ok` — **no confidentiality ceiling at all**;
- `app.is_case_excluded` — **no exclusion term**, so the **respondent and the recused read it too**.

**Blast radius:** every active member of a commission can read **every interview attachment of every
case in that commission**, including `explicit_grants_only` ethics cases, regardless of confidentiality
label, regardless of recusal. Interview content is PHI-capable (`case_interviews.summary_md` is
PHI-bearing free text by its own column comment) and interview attachments are the evidentiary annexes
to it. **This is a live Rule 12 exposure, not a Stage-A regression risk**, and it is named in no ADR,
plan, or keystone. The contrast with `attachments_obj_select_readable` — which correctly rides
`app.can_read_attachment(foldername[1], foldername[2]::uuid, auth.uid())` — makes the omission stark.

**Keystone 22 ("the member arm reads nothing else… not interviews, not attachments") fails on this
bucket** after A15 narrows the member arm. The inventory is right.

## 2.2 · `assign_case_phases` → PHI — traced end-to-end, **PHI is genuinely reachable**

Link 1 — `activate_phase` (DEFINER) admits the delegate:
```
if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)
        or app.member_can(v_commission_id, 'assign_case_phases')) then
  raise exception 'sem permissão' using errcode = '42501';
```
Link 2 — the assignee is checked for **membership only**, so the delegate may name **herself**:
```
if not app.is_member_of_for(v_commission_id, p_assigned_to) then
  raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
```
Link 3 — the write: `update public.case_phases set status='active', assigned_to = p_assigned_to, …`
Link 4 — `app.can_read_case_patient`, **with no level filter and no `is_active`**:
```
or exists (select 1 from public.case_phases cp
           where cp.case_id = p_case_id and cp.assigned_to = p_uid)
```

**Verdict: CONFIRMED.** A non-coordinator `administrativo` delegate grants **Standard PHI** on any open
case in the commission, to anyone including herself, with no grant row, no expiry, no reason code and
no access-decision audit. The inventory's reading of `activate_phase`'s own comment is also exact — it
acknowledges *"case READ (via can_read_case's assignee arm)"* and is **silent on the PHI half**.
ADR 0061's "delegated-capability, not authority-granting" framing (and O8's premise) is contradicted by
the catalog.

## 2.3 · The second `case_access` coupling — **CONFIRMED, and B1 breaks interview reads**

```
=== app.confidentiality_clearance_ok
  return exists (select 1 from public.case_access ca
                 where ca.case_id = p_case_id and ca.user_id = p_uid
                   and (ca.expires_at is null or ca.expires_at > now())
                   and ca.max_confidentiality is not null
                   and app.confidentiality_rank(ca.max_confidentiality) >= app.confidentiality_rank(p_label));

=== app.can_read_interview
  select p_uid is not null and exists (
    select 1 from public.case_interviews ci
    where ci.id = p_interview_id
      and app.can_read_case_or_admin(ci.case_id, p_uid)
      and app.confidentiality_clearance_ok(ci.case_id, ci.confidentiality_level, p_uid));
```

Direct `public.case_access` read, consumed by `can_read_interview`, hence by `case_interviews_select`,
`case_interview_interviewers_select` and `case_interview_subjects_select`. **D5·4/B3 name only
`attachment_confidentiality_ok`. B1's hard cut drops `case_access` → `confidentiality_clearance_ok`
fails to compile → the entire interview read family breaks.** The inventory is right; B3 must repoint
**both**.

## 2.4 · A20 / B7 — **CONFIRMED**

```
update_professional_profile args:
  p_profile_id, p_full_name, p_professional_type, p_license_number,
  p_license_region, p_specialty, p_affiliation_status          ← no p_user_id
professional_profiles_user_id_fkey  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
fns touching professional_profiles: app.is_case_respondent, public.create_professional_profile,
                                    public.update_professional_profile, public.get_case_professional   (4, not 2)
```

Linkage is **write-once** (only `create_professional_profile` writes `user_id`), so A20's
"resolve it at the moment he is named" is **unimplementable for existing profiles** — B7 must add the
write path, and the plan does not mention it. `ON DELETE SET NULL` silently NULLs the linkage *after*
attach, which B7's attach-time check cannot see. Both correct and both blocking for B7.

## 2.5 · §1.6 — **CONFIRMED**

```
fns referencing visibility_policy:
  app.can_reach_case_on_member_surface, app.can_read_case, app.can_read_case_patient   (readers)
  public.create_case_from_template                                                      (the only writer)

case_types: key='ethics', default_visibility_policy='explicit_grants_only'
```

`create_case` does **not** reference `visibility_policy` at all → two creation doors, two outcomes.
Nothing writes it post-insert → D11's and A1's "per-case override, set by the coordinator" **has no
door**. And `ethics` is seeded `explicit_grants_only` **today**, which A1 reverses — so plan A3/C0 is a
**seed value change**, exactly as the inventory says. Load-bearing, because A15 makes
`visibility_policy` *the* axis the member arm keys on.

---

# 3 · NEW findings the inventory missed

## ⛔ NEW-1 · **P0 — the exclusion model has THREE self-serving mutators, not one. The respondent arm has two, and one opens PHI. PROVEN LIVE.**

The inventory frames §1.1 as a lone asymmetry (*"the asymmetry looks like an oversight"*) and offers
`record_recusal` as the contrast that "gets this right". **That framing hides the larger half of the
hole.** `app.is_case_excluded` is a union of **two** arms:

```
=== app.is_case_excluded
  select p_uid is not null
     and (app.is_case_respondent(p_case_id, p_uid) or app.is_recused_from_case(p_case_id, p_uid));
```

The inventory audited the mutators of the **recusal** arm and found `lift_recusal`. It never audited
the mutators of the **respondent** arm. `is_case_respondent` resolves through three mutable facts:

```
=== app.is_case_respondent
  ... from public.case_participants cp
      join public.case_participant_roles r on r.id = cp.role_id
      join public.professional_participants pp on pp.participant_id = cp.participant_id
      join public.professional_profiles prof on prof.id = pp.professional_profile_id
     where cp.case_id = p_case_id
       and cp.removed_at is null          ← mutable by remove_case_participant
       and r.key = 'respondent_doctor'    ← mutable by set_case_participant_role
       and prof.user_id = p_uid           ← mutable by nothing (write-once — §2.4)
```

**Both mutators carry `lift_recusal`'s exact shape** — DEFINER, bare role gate, no self-check, no
exclusion:

```
=== remove_case_participant   definer=true
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso' using errcode='HC0E4';
  update public.case_participants set removed_at = now() where id = p_case_participant_id;

=== set_case_participant_role   definer=true
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso' using errcode='HC0E4';
  update public.case_participants set role_id = p_role_id where id = p_case_participant_id;
```

### Proof (transaction, `ROLLBACK`ed; persistence re-verified)

Scenario: **the ethics complaint is against the committee coordinator** — the PO's own A2 scenario, and
D11's own premise (*"the respondent is a committee member"*). Seed persona
`staff4.ccih@test.local` is the only linked respondent (`professional_profiles`: 1 linked / 1 total),
on case `ca…e1` (`ethics`, `explicit_grants_only`).

```
 stage  | respondent | excluded | can_read | can_read_phi
--------+------------+----------+----------+--------------
 BEFORE | t          | t        | f        | f            ← ETH·E1's deny working correctly

set local role authenticated;  -- her own JWT
select public.remove_case_participant('fd…e1');   -- her OWN respondent_doctor row → SUCCEEDS

 stage | respondent | excluded | can_read | can_read_phi
-------+------------+----------+----------+--------------
 AFTER | f          | f        | t        | t            ← reads the case AND ITS PHI
```

Post-rollback: `role='staff'`, `removed_at=null`, `is_case_respondent = t`. Nothing persisted.

**This is strictly worse than `lift_recusal`.** The inventory's `lift_recusal` probe flips
`can_read_case` only. This flips **`can_read_case_patient` from `f` to `t`** — because
`can_read_case_patient`'s `is_staff_admin_of_for` arm sits directly behind the respondent deny. **The
respondent doctor reads the patient identifiers of the case in which he is the accused.** That is
Rule 12 and Row zero failing in the same call.

`set_case_participant_role` is the same defect by a second route (re-key the role away from
`respondent_doctor`), and `set_primary_subject` shares the gate.

**Consequence for the program:** the ADR's Row zero, keystones 4/10/12/22/23/24/25/27, and A20/B7 all
rest on `is_case_excluded`. **B7 makes the respondent arm *resolvable*; it does not make it
*durable*.** A respondent who is a coordinator deletes his own respondent status before B7's linkage
ever matters. **B7 and the `lift_recusal` fix are both incomplete without this.**

## ⛔ NEW-2 · **P1 — the inventory's headline query (Q7) reproduces the exact blind spot A23 named**

Q7 filters `where n.nspname='public' and p.prosrc ilike '%is_commission_admin_of%'`. But **A13 proved
`is_commission_admin_of` ≠ `staff_admin`**, and the Risks table states the arm that out-votes the deny
for a **recused coordinator** is **`is_staff_admin_of`**. So **any DEFINER case RPC gated on
`is_staff_admin_of` alone is invisible to Q7** — and those are precisely the recused-coordinator doors.

The inventory's §5·8 correctly identifies `prosecdef` as A23's missing methodology axis. It then adds
`prosecdef` to a query still keyed on the wrong arm. Complement sweep:

```
proname                    | definer | excl | readgate
count_open_cases_for_board |    t    |  f   |    f       ← §1.3's companion, named nowhere
get_referral_detail        |    t    |  f   |    f
set_case_offered_outcomes  |    t    |  f   |    f
set_participant_patient    |    t    |  f   |    t
```

`set_case_offered_outcomes` (DEFINER) is the sharpest:
```
if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
  raise exception 'sem permissão' using errcode = '42501';
```
No exclusion → a **recused coordinator mutates the case's offered outcomes**. **And note the
`app.is_admin()` arm** — `platform_admin`, which CLAUDE.md says is *"walled off from all tenant
data"*, holds a write arm on case content. That arm is named in no document and is not in the KEEP
list. It deserves a ruling.

**Required:** re-run the inventory's sweep as `(prosrc ilike '%is_commission_admin_of%' OR prosrc ilike
'%is_staff_admin_of%' OR prosrc ilike '%is_admin()%' OR prosrc ilike '%member_can%')`. The current 37
is a floor, not the population.

## ⛔ NEW-3 · **P2 — `case_interviews_insert` is missing from §1.4**

§1.4 names `_update` and `_delete`. The catalog has a third:

```
case_interviews :: case_interviews_insert :: INSERT ::
  with_check = (app.is_staff_admin_of(commission_id) OR app.is_commission_admin_of(commission_id))
```

**No exclusion term and no case term at all** — it is keyed on the row's own `commission_id`, i.e. the
`action_items_staff_admin_write`/A22 shape on the interview family. A recused coordinator inserts
interviews; an Organization User inserts interviews into any case in the commission. Since `create_interview`
(the DEFINER door) is *also* unguarded, both the RPC and the direct PostgREST path are open.

## ⚠ NEW-4 · **P2 — `case_access` carries `authenticated` INSERT/UPDATE grants today**

```
case_access | authenticated | INSERT | 8
case_access | authenticated | UPDATE | 8
case_access | authenticated | SELECT | 8
```
Only `case_access_select` exists as a policy, so RLS denies the DML by default (fail-closed) — **not a
live hole**. Recorded because **D5·3/B2 make "no direct authenticated INSERT/UPDATE/DELETE" a
requirement of the new table**, and the current table is the pattern an implementer will copy. B1 must
`REVOKE ALL … FROM PUBLIC` and grant explicitly rather than inherit this shape.

## ✅ Structural blind spots I checked and cleared (record, so nobody re-opens them)

| Surface | Result |
|---|---|
| **Views** (RLS on a view runs as owner; `security_invoker`) | **No views in `public`** (`relkind='v'` → 0 rows). Blind spot is empty. |
| **DEFINER functions without a pinned `search_path`** | **0** — posture is clean, D13·5 already holds. |
| **Tables with RLS disabled** (case/meeting/professional/participants) | **0** — all have `relrowsecurity = t`. |
| **Column-level GRANTs** | Checked (this repo has `case_referral` precedent). Grants on case/meeting tables are whole-table (`ncols` = full column count), not partial. No hidden narrowing/widening. |
| **Storage** | All 19 object policies enumerated; findings in §2.1. |

**Not cleared — must be added to A0:** `pg_trigger`. I did not find a defect, but the inventory does
not enumerate triggers, and the ADR's own step-6 deletion rests on `app.guard_case_status`
(`HC025`) + the `app.in_case_rpc` escape hatch. A trigger that a DEFINER RPC disables via
`set_config` is exactly the "invisible to a policy-shaped audit" class. **A0 should enumerate the
triggers on case-content tables and record which RPCs set `in_case_rpc`/`in_narrative_rpc`.**

---

# 4 · Reproducibility — ✅ **fully verified**

Every count re-ran exactly:

```
select count(*) from supabase_migrations.schema_migrations;                                   -- 110 ✅
select count(*) from pg_policies where qual ilike '%is_commission_admin_of%' …;               --  93 ✅
select count(*) from pg_proc … where prosrc ilike '%is_commission_admin_of%';                 -- 121 ✅
select count(*) from pg_policies where qual ilike '%is_staff_admin_of%' …;                    --  50 ✅
select count(*) from pg_proc … where prosrc ilike '%is_staff_admin_of%';                      -- 132 ✅
Q4 case_access dependents                                                                     --  24 ✅
Q1 FOR ALL permissive on case/meeting/action_item                                             --  23 ✅
Q7                                                                                            --  37 ✅
```

The ADR's stale "119 functions" is indeed **121**, and "109 migrations" is **110**. The deliverable's
queries are genuine, pasted accurately, and re-runnable. **This is the standard A0 was supposed to set,
and it meets it.** The provenance section's claims (catalog-only, one rolled-back probe) are consistent
with everything I could check.

---

# 5 · Over-reach audit (things wrongly marked for removal)

The KEEP list is **substantially correct** and I confirmed its load-bearing entries
(`dispose_meeting_minutes` → `void`; `audit_log_select` → Rule 11 oversight; `case_types*` → ride
`is_admin()`/`is_org_admin_of`, genuinely out of scope; `case_tags`/`case_outcomes`/
`case_narrative_types` → commission-level config, correctly no exclusion term). It correctly refuses
the global sweep. **But three problems:**

## 5.1 ⛔ **§3.6 contradicts §2's KEEP list — twice**

| Object | §2 KEEP list | §3.6 | Correct |
|---|---|---|---|
| `list_case_access` | **KEEP** — *"the grant door … the Organization User keeps its arm here and only here"* (A18) | **"Remaining, REMOVE-ARM per A21·1"** | **KEEP** — A18 names it explicitly |
| `grant_member_capability` | **KEEP** — *"membership / role management · grant_member_capability | staffing"* | **"Remaining, REMOVE-ARM per A21·1"** | **KEEP** — it is the staffing door (ADR 0061 delegation), and the line is *"an Organization User configures a commission and staffs it"* |

An implementer working from §3.6 (the actionable table) removes an arm §2 protects. **Keystone 23/24
fail if this ships.** Resolve the contradiction explicitly in favour of KEEP.

## 5.2 ⛔ **`case_tag_report` cannot take the fix the §1.2 table prescribes — category error**

```
case_tag_report | p_commission_id uuid, p_from date, p_to date
```
It is **commission-scoped**. There is **no `case_id`** to pass to `is_case_excluded(?, auth.uid())`.
The §1.2 table lists it under "add the exclusion gate"; that SQL cannot be written.

This exposes a real structural gap: **§1.2 conflates two distinct remediation shapes.**

| Shape | RPCs | Fix |
|---|---|---|
| **Case-scoped** (`p_case_id` / resolvable) | `lift_recusal`, `dispose_case_phi`, `add_case_participant`, `activate_phase`, … | add `AND NOT app.is_case_excluded(<case>, auth.uid())` **gate** |
| **Commission-scoped list/aggregate** | `case_tag_report`, `list_cases_board`, `count_open_cases_for_board` | **no gate is possible** — requires a **per-row filter** (`can_read_case` / `NOT is_case_excluded` inside the query) |

§1.3 gets `list_cases_board` right (per-row). §1.2 then puts `case_tag_report` in the gate bucket.
**A0 must separate these before SQL**, or the migration is authored against an impossible instruction.

## 5.3 ⚠ `case_events_writer_write` — the inventory's "not a defect" call is **correct**

`ALL :: app.can_write_case_content(case_id, auth.uid())`. Consistent with the lattice (`WCC ⇒ RCC`),
deny-first inside the DEFINER. ✅ Correctly **not** flagged. Good discipline — recorded so a later
reviewer does not "fix" it.

---

# 6 · Is A0 a sufficient foundation to author SQL against?

**Not yet.** It is close. The following must be added first — all mechanical:

| # | Required addition | Why blocking |
|---|---|---|
| **1** | **Correct the fix set from 13/15 → 30 DEFINER RPCs.** Add the 10 in §1.2 above (`conclude_narrative`, `reopen_narrative`, `unassign_narrative`, `set_case_phase_result_override`, `update_case_meta`, `create_case_from_template`, `create_referral_draft`, `conclude_meeting`, + resolve `list_case_access`/`grant_member_capability` per §5.1), plus `record_recusal`. | SQL authored from the current table leaves `is_staff_admin_of` unqualified on 10 DEFINER doors — the inventory's own A22 defect, 10×. |
| **2** | **Add the respondent-arm mutators (NEW-1):** `remove_case_participant`, `set_case_participant_role`, `set_primary_subject`. | Row zero is self-deletable via the respondent arm, opening **PHI**. Proven live. |
| **3** | **Re-run the sweep on `is_staff_admin_of` / `is_admin()` / `member_can`, not only `is_commission_admin_of` (NEW-2).** | 37 is a floor. 4 known RPCs are invisible to Q7 today; the population is unbounded until re-run. |
| **4** | **Split the fix set by remediation shape (§5.2).** | `case_tag_report`'s prescribed fix is unwritable. |
| **5** | **Resolve the §2↔§3.6 contradiction (§5.1).** | Over-reach on the grant + staffing doors → keystones 23/24. |
| **6** | **Add `case_interviews_insert` (NEW-3).** | Completes the interview family. |
| **7** | **Enumerate `pg_trigger` on case-content tables + the `in_case_rpc` escape hatches.** | The last un-swept structural surface; the ADR's step-6 deletion depends on it. |
| **8** | **State the B7 write-path requirement explicitly** (§2.4) — `update_professional_profile` needs `p_user_id`, and `ON DELETE SET NULL` needs a ruling. | B7 is unimplementable as the plan scopes it. |

**What does NOT need to change:** the methodology, the provenance discipline, the KEEP list's
substance, the INVOKER negative, the query appendix, and all eight §1.x findings — which are **all
confirmed**.

## PO / lead rulings needed (product questions, not gate items)

1. **Who may lift a recusal / remove a respondent?** (§1.1 + NEW-1.) The inventory's A18-transfer
   reasoning is sound and I endorse it: `AND NOT is_case_excluded(...)` **plus** an Organization User
   arm, which is safe by construction because Org Users are not members and cannot self-grant. **This
   must cover `remove_case_participant` / `set_case_participant_role` / `set_primary_subject`, not just
   `lift_recusal`.**
2. **`app.is_admin()` (platform_admin) on `set_case_offered_outcomes`** — reconcile with CLAUDE.md's
   "walled off from all tenant data".
3. **The `interview-attachments` + `case-documents` buckets** (§2.1) — these are live exposures on a
   PHI-capable surface. Confirm they are in scope for this program rather than deferred to Stage E.

---

# 7 · Sequencing recommendation

**AGREE with `backend`, with the scope corrected — and I would strengthen the argument.**

Land, as **one reviewable migration, first, before the resolver**:

1. **B7** (respondent linkage: resolved state + the `user_id` **write path** + the `ON DELETE SET NULL` ruling);
2. **`lift_recusal`** + **the three respondent-arm mutators** (NEW-1);
3. **the DEFINER exclusion sweep — all 30, split by remediation shape** (§5.2), *after* the NEW-2 re-sweep sets the real population.

**Reasoning.**

- The argument `backend` makes is correct and the plan's Risks table already makes it for B7: *every
  exclusion keystone in the program is vacuous until this lands.* NEW-1 **strengthens** it — B7 alone
  makes the respondent arm **resolvable but not durable**. Shipping B7 without the mutator fixes buys a
  keystone that passes while the respondent deletes his own respondent row. That is precisely the
  "a claim no test can falsify" failure the Risks table names, and it would be **the second time**
  this program shipped a keystone that cannot fail.
- These fixes are **independent of `_case_caps`**. They are one-predicate edits to DEFINER gates and to
  a nullable column. They do not touch the resolver, the member arm, or any policy. There is no
  coupling that argues for bundling them later.
- **They are net-tightening on a live defect.** They are `EXPLAIN`-neutral (no policy repoints), so
  A5's performance gate does not block them.
- **Ordering within the migration matters:** B7 **before** the mutator fixes. The mutator fix for the
  respondent arm is `NOT is_case_excluded(...)`, which is only meaningful once `is_case_respondent`
  actually resolves. Landing them in the other order produces a gate that passes for the very principal
  it must deny.
- **Add a gating requirement:** pair each fix with an **over-grant keystone** (Risks-table template,
  keystone 22's shape). Specifically, the NEW-1 keystone must be *"the respondent-coordinator calls
  `remove_case_participant` on her own row and it FAILS; `is_case_respondent` survives her"* — asserted
  on **rows read under `set local role authenticated`**, not on a predicate's return value. My probe
  above is the exact fixture; it is seeded and ready (`staff4.ccih@test.local` / case `ca…e1`).

**One caveat on the split.** `backend` proposes this land before the resolver. Agreed — but the **A21
admin-arm removal must NOT be folded into it.** That is a behaviour change requiring the resolver
(D4·3: *"lands after the resolver, never as a standalone policy edit"*). Keep migration 1 to
**exclusion durability only**. It is a clean, small, reviewable unit that makes Row zero real, and
nothing else in the program can be trusted until it exists.

---

## Summary

| | |
|---|---|
| **Verdict** | ⛔ **CHANGES REQUESTED** |
| Findings verified | **21 confirmed, 0 refuted** |
| New findings | **4** (1 × P0 proven live, 1 × P1 methodology, 2 × P2) |
| Over-reach found | **3** (2 × internal contradiction, 1 × category error) |
| Blind spots cleared | views · `search_path` · RLS-off tables · column grants |
| Blind spot remaining | **`pg_trigger`** |
| Re-review | Should be fast — every item is mechanical; no redesign required |

**Credit where due:** this inventory found three real P0/P1 defects that the ADR, the plan, and every
keystone missed, and it did so by following the catalog-driven methodology exactly. Its own conclusion
— that `prosecdef` was the missing methodology axis — is correct and is the single most valuable
sentence in the document. The changes requested are the same lesson applied one turn further: the
author added `prosecdef` to a query still keyed on the wrong arm, and audited the mutators of one
exclusion arm but not the other. **An author cannot falsify their own claim.** That is the third time
this program has proven it.

---
---

<a name="v2-review--the-a0-delta"></a>

# PART II â€” v2 review Â· the A0 delta

**Date:** 2026-07-15 Â· **Reviewer:** `qa` Â· **Subject:** `docs/progress/authz-capability-inventory.md` **v2**
**Method:** live catalog only â€” `pg_proc` (incl. `prosecdef`), `pg_policies`, `pg_policy`, `pg_class.relacl`,
`pg_trigger`, `pg_auth_members`, `information_schema.role_{table,column}_grants`. **No file text, no grep,
no graphify.** Local stack, 110 migrations, branch == catalog. **Four live probes, each `ROLLBACK`ed;
persistence re-verified after each (0 rows leaked).** The repo's graphify hook was **deliberately not
followed** â€” it does not index SQL, and file text is stale by this program's own METHODOLOGY FINDING.

# VERDICT: CHANGES REQUESTED

**Is A0 v2 a sufficient foundation to author M1's SQL against? â€” NO. Not yet, and by a narrow, specific margin.**

v2 is a **materially better document than v1** and better than my own review of it. It corrected me on two
counts, both correctly. Its numbers are exact. Its method is now the best in the program. **It fails this
gate on one thing only:**

> **M1's entire purpose (A29) is that "the exclusion keystones stop being vacuous."**
> **A0 v2's fix set does not achieve that purpose.** A **sixth** exclusion-plane table â€”
> `case_participant_roles`, the second table in `is_case_respondent`'s **own join** â€” carries
> **direct `authenticated` `arwd` grants, a `FOR ALL` write policy, and zero triggers**. An `org_admin`
> (or `platform_admin`, via the `is_admin()` arm) **re-keys the row the deny reads, over direct DML, with
> no RPC and no audit record** â€” and `is_case_excluded` flips **t to f** for **every case in the
> organization**. **Proven live, rolled back (V-3).**
>
> Ship M1 as scoped and Row zero is **still not durable** â€” while a keystone asserts that it is. That is
> this program's signature failure, for the **fifth** time.

The fix is small and belongs *in* M1. **Re-review will be fast.**

---

## V-0 Â· Corrections to my own v1 â€” visible, not silent

`backend` pushed back on two counts. **I re-ran both myself. On both, `backend` is right and I was wrong.**

### V-0.1 Â· C1a is CONFIRMED. My v1 fixture does not reproduce. (v1 Â§7 is WRONG)

I offered my probe as *"the exact fixture; it is seeded and ready (`staff4.ccih@test.local` / case `caâ€¦e1`)."*
**It is not.** The catalog:

```
 cp_id  fdâ€¦e1 | case_id caâ€¦e1 | resp_uid 00â€¦0a | staff4.ccih@test.local
 is_staff_admin_row = 0 | seeded_roles = staff        <-- plain staff, NOT staff_admin
```

**PROBE 2 â€” my v1 fixture run verbatim:**
```
 BEFORE | respondent t | excluded t | can_read f | can_read_phi f
 set local role authenticated;  select public.remove_case_participant('fdâ€¦e1');
 ERROR:  apenas a coordenaÃ§Ã£o pode gerenciar participantes deste caso   <-- correctly DENIED (HC0E4)
```

`backend`'s reading of the consequence is exactly right and is the more important half: **a pgTAP keystone
built from my report as written would call the RPC as plain-`staff`, catch `HC0E4`, and go green while
asserting nothing.** I filed a finding about vacuous keystones and shipped a vacuous fixture in the same
document. **C1a accepted in full.**

### V-0.2 Â· C4 is CONFIRMED. My "30" was a floor. (v1 Â§6Â·1 is WRONG)

I condemned Q7's `is_commission_admin_of` filter as A23's blind spot **and then re-ran it** to produce my
own number. **Q7Â·v2 re-run verbatim â†’ 49 rows**, partitioning **exactly** as v2 claims:

| Bucket | v2 claims | Catalog | |
|---|---|---|---|
| **Population** (4 arms) | 49 | **49** | OK |
| **DEFINER Â· no exclusion Â· no read gate â€” THE FIX SET** | 35 | **35** | OK |
| DEFINER Â· no exclusion Â· has read gate | 4 | **4** | OK |
| DEFINER Â· **has** the exclusion gate | 3 | **3** | OK |
| INVOKER â€” DO NOT FIX | 7 | **7** | OK |
| **`platform_admin` (`is_admin()`) arms** | 4 | **4** | OK |

**C4 accepted; my 30 becomes 35, my 37 becomes 49.**

### V-0.3 Â· A **third** v1 error `backend` did not catch â€” and v2's stricter query is what exposed it

My v1 complement sweep reported `set_participant_patient` with **`readgate = t`**. It is **`f`**:

```
 proname                 | loose_match_v1qa | strict_match_v2
 set_participant_patient | t                | f
```

The string `can_read_case` appears in that function **only inside a comment** â€”
`-- COORDINATOR-ONLY write gate (not can_read_case â€” that is the broad READ scope)`. My looser pattern
matched the comment. **v2's `%can_read_case(%` is correct and mine was not** â€” and my error ran in the
*dangerous* direction: it credited a PHI-write door with a read gate it does not have.

### V-0.4 Â· Lead correction accepted â€” `is_admin()` is **not** a forgeable claim

v2 Â§1.6 writes that `is_admin()` *"also honours a **JWT claim**"* in a tone that reads as an escalation
path. The catalog confirms the claim is read (`request.jwt.claims ->> 'is_admin'`), but the lead is right
that it is **minted server-side** by `custom_access_token_hook` from `profiles.is_admin` (ADR 0002). **It is
a cache, not an escalation vector.** The only residual is **staleness** (a revoked admin keeps the claim
until refresh) â€” already backlogged as session revocation. **v2 must re-word this; it must not ship as a
privilege-escalation finding.** *(This is a wording fix, not a gate item.)*

---

## V-1 Â· The three probes, re-run by someone who did not write them

Per `backend`'s own closing proposal â€” now a standing rule â€” **every probe offered as a fixture is re-run
by someone who did not write it.** I am that someone for v2, as `backend` was for me.

| Probe | Reproduces **exactly as documented**? |
|---|---|
| **PROBE 1 Â· `lift_recusal`** (recusal arm) | **YES** â€” `recused t to f`, `can_read f to t`. Post-rollback: 0 rows leaked. **But see V-1.1 â€” it under-states itself.** |
| **PROBE 2 Â· `qa` v1's fixture as documented** | **YES â€” it reproduces as a DISPROOF.** `HC0E4`, correctly denied. **v2's C1a is right.** |
| **PROBE 3 Â· respondent arm + the precondition** | **YES, exactly** â€” `respondent t/f Â· excluded t/f Â· can_read f/t Â· can_read_phi f/t`. Post-rollback: `respondent=t`, 0 leaked `staff_admin` rows, `case_participants` row intact. |

**All three hold, including preconditions.** v2 meets the standard it held me to. The `remove_case_participant`
finding **stands, at unchanged severity, with the precondition now written down narrowly**: *respondent
**AND** `staff_admin` of the same commission*.

### V-1.1 Â· Both v1 and v2 **under-state `lift_recusal`** â€” it is also a PHI door

v2 Â§1.1 records: *"`lift_recusal` â€” PROVEN LIVE: â€¦ `can_read_case` f to t"*, and frames the respondent arm
as **"strictly worse"** *because* it reaches PHI. **My PROBE 1 says that framing is wrong.** Running it
against a **coordinator** (`chefe.ccih@test.local` â€” which is the only principal `lift_recusal` is *about*):

```
 BEFORE | recused t | can_read f | can_read_phi f
 -- as herself, authenticated: lift_recusal(<her own recusal>) -> SUCCEEDS
 AFTER  | recused f | can_read t | can_read_phi t        <-- PHI, same as the respondent arm
```

`can_read_case_patient`'s `is_staff_admin_of_for` arm sits directly behind the recusal deny too. **The
recusal arm is equally a Rule 12 door.** Consequence: the PO ruling on *"who may lift a recusal"* is a
**PHI decision**, not merely a reach decision, and both arms are **equal-severity P0**. The fix set does not
change (both are already in Â§3.6Â·A1) â€” **the severity narrative does.**

---

## V-2 Â· The five accepted corrections â€” all VERIFIED

| # | Claim | Catalog verdict |
|---|---|---|
| **C2** | The 10 "REMOVE-ARM only" DEFINER RPCs re-classified **FIX** | **CORRECT.** Confirmed in Q7Â·v2: all 10 are `definer=t, excl=f, readgate=f`. Stripping `is_commission_admin_of` leaves `is_staff_admin_of` unqualified â€” the A22 defect. v2 concedes v1 was wrong; the concession is right. |
| **C6** | **KEEP** `list_case_access` + `grant_member_capability` | **CORRECT.** `list_case_access(p_case uuid)` = the A18 grant door; `grant_member_capability(p_commission_id, p_user_id, p_capability)` = the staffing door. **Resolved in favour of KEEP is right**; keystones 23/24 would have failed. v2's note that *keeping the arm* and *adding the deny* are **orthogonal** is the correct framing. |
| **C7** | `case_tag_report` category error | **CORRECT.** `case_tag_report(p_commission_id uuid, p_from date, p_to date)` â€” **no `case_id`**. The prescribed gate is genuinely unwritable. The gates-vs-per-row-filters split (Â§3.6Â·A/B) is the right structure. |
| **C3** | 13-vs-15 header corrected; exact partition published | **CORRECT** (V-0.2). |
| **C9â€“C12** | `case_interviews_insert` Â· `case_access` grant pattern Â· `record_recusal` Â· B7 write path | **ALL CORRECT.** `case_interviews_insert` `with_check = (is_staff_admin_of OR is_commission_admin_of)`, no case term. `record_recusal` splits self/other but has **no exclusion term** (`excl=f` in Q7Â·v2). B7: `update_professional_profile` has no `p_user_id`; FK is `ON DELETE SET NULL`. |

### V-2.1 Â· The action-column re-audit (Â§3.7) â€” claim of "0 further over-reach" is VERIFIED

Over-reach is the error that breaks legitimate admin surface, so I checked **both directions**:

| Direction | Result |
|---|---|
| Marked **KEEP** but genuinely case-scoped content | **0 â€” CONFIRMED.** `case_tags` / `case_outcomes` / `case_narrative_types` are keyed on `commission_id`; `case_types` / `case_participant_roles` on `organization_id` via `is_admin() OR is_org_admin_of`. All genuinely configuration. |
| Marked **FIX** but INVOKER (RLS already protects) | **0 â€” CONFIRMED.** All 7 INVOKER RPCs sit in bucket D. The load-bearing negative **still holds**: `close_case`/`cancel_case`/`set_case_outcome`/`update_case_narrative_body` are `prosecdef=f`. **Do not sweep them.** |
| Marked FIX but unwritable | **1, fixed** â€” `case_tag_report` to bucket B. |

**v2's "0 further over-reach" is accurate.** *(But see V-4: there is under-reach â€” a different error.)*

---

## V-3 Â· THE BLOCKING FINDING â€” C8's disproof is right on its legs and wrong on its scope

The mandate flagged C8 as *"exactly the kind of negative that is comfortable to accept and expensive to get
wrong."* It was. **I verified every leg independently. Every leg holds â€” on the five tables v2 chose.**

### V-3.1 Â· The legs, verified three ways

| Leg | v2 claims | My verification |
|---|---|---|
| 0 write policies | 0 | **0** â€” and I schema-qualified it (v2's Q15 did **not** filter `schemaname`). All 5 `relrowsecurity=t`. |
| **0 `authenticated` DML grants** | 0 | **0**, verified **three** ways: `role_table_grants` (SELECT only) Â· **`role_column_grants`** â€” the repo's `case_referral` precedent â€” **0 rows** Â· and decisively the raw ACL: **`authenticated=r/postgres`** (read only). `pg_auth_members` shows **no role inheritance**; no `PUBLIC` ACL entry. |
| All 6 mutators call `audit_write` | yes | **all 6** â€” and I checked it is a **real `perform app.audit_write(...)` statement**, unconditional, after the write, in each body â€” *not* a text match on a comment. (This mattered: the same false-positive class produced my own V-0.3 error.) |

**On its own terms, C8's disproof is sound and I endorse it.** Recording a disproof rather than a
hypothesis is the right discipline.

### V-3.2 Â· But the five tables are not the exclusion plane. There is a sixth.

A27 is **binding** and v2 quotes it in its own Â§1.1:

> *"For **each** arm `is_case_excluded` resolves through, enumerate **EVERY** mutator of the rows it reads."*

`is_case_respondent` â€” from the live catalog â€” reads rows from **five** tables:

```sql
  from public.case_participants cp
  join public.case_participant_roles r on r.id = cp.role_id          -- THIS ONE
  join public.professional_participants pp on pp.participant_id = cp.participant_id
  join public.professional_profiles prof on prof.id = pp.professional_profile_id
  where cp.case_id = p_case_id
    and cp.removed_at is null
    and r.key = 'respondent_doctor'                                   -- A ROW THE DENY READS
```

**`case_participant_roles.key` is a row the deny reads.** v2 swept `case_participants`, `case_recusals`,
`case_conflict_declarations`, `professional_profiles`, `professional_participants` â€” and **omitted the
second table in its own join**, filing it instead on the **KEEP list** as *"org config, out of scope"*.

**Re-running C8's own three legs against the omitted table â€” all three FAIL:**

```
          relname           | write_policies |   auth_dml_grants    | triggers
 case_participants          |              0 |                      |        1
 case_recusals              |              0 |                      |        0
 case_conflict_declarations |              0 |                      |        0
 professional_profiles      |              0 |                      |        0
 professional_participants  |              0 |                      |        0
 case_participant_roles     |              1 | DELETE,INSERT,UPDATE  |        0   <-- ALL THREE LEGS FAIL
```

Raw ACL, decisive â€” note it differs from every other exclusion-plane table:
```
 case_participant_roles | authenticated=arwd/postgres     <-- not r
 case_participants      | authenticated=r/postgres
```
Policy: `case_participant_roles_admin_write :: ALL :: (app.is_admin() OR app.is_org_admin_of(organization_id))`.
No trigger. **And no RPC writes `key`** â€” `set_participant_patient` / `add_case_participant` /
`set_case_participant_role` only read or insert role rows.

**C8's conclusion is exactly inverted here: the RPC is not the only door â€” there is no RPC door at all,
only unaudited direct DML.**

### V-3.3 Â· PROBE 4 â€” proven live, rolled back (I did not offer this unverified)

```sql
begin;
  -- BEFORE | respondent t | excluded t
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"â€¦b1","role":"authenticated"}', true);  -- orgadmin.a@test.local
  -- DIRECT PostgREST DML. No RPC. No audit_write.
  update public.case_participant_roles set key='former_respondent' where id='fcâ€¦e1';
  -- UPDATE 1                                          <-- SUCCEEDS
  reset role;
  -- AFTER  | respondent f | excluded f                <-- THE DENY IS GONE
rollback;
-- POST-ROLLBACK | key='respondent_doctor' | respondent=t     <-- nothing persisted
```

**Blast radius.** The role row is **org-scoped** (`organization_id`), shared by every case in the
organization that uses it. One `UPDATE` of one column dissolves the respondent deny **org-wide** â€”
and with it `can_read_case_patient`'s deny, i.e. **PHI on every ethics case in the org**. In the seed that
is 1 case; structurally it is unbounded. **Unaudited** (0 triggers; direct DML never reaches `audit_write`),
so it is not even *detectable*, which is the fallback C8 leans on for the other five tables.

**Reachable by:** `org_admin` / `hospital_admin` (`is_org_admin_of`) **and `platform_admin`** (the
`is_admin()` arm) â€” i.e. **this is simultaneously a 5th `platform_admin` arm on tenant data**, which A30
requires `backend` to enumerate **exhaustively**. The enumeration returned 4. **It is 5.**

### V-3.4 Â· Why this is CHANGES REQUESTED and not a note

Not because it is bigger than what v2 found â€” it is not. Because of **what M1 is for**:

- **A29 states M1's purpose:** *"Migration 1 buys exactly one thing: the exclusion keystones stop being
  vacuous."* Ship B7 + the 4 mutators + the 35 RPCs and **Row zero is still not durable** â€” the deny is
  still deletable, one join-table over, by a principal the program has not been thinking about.
- It is the **exact error class v2 just corrected in C2**, one layer further out: v2 applied A27's lens to
  `case_participants` and not to the table `case_participants` **joins to**. v1 applied its own A22 lens to
  policies and not to its RPC list. **Same shape, third occurrence.** An author cannot falsify their own
  claim â€” which is now proven in **both** directions, including against me (V-0).
- **The fix belongs in M1 and fits its constraints**: freeze `key` once referenced (immutability trigger,
  the `guard_case_status`/`HC025` pattern already in this repo) and/or `REVOKE` the direct `arwd` grant so
  the mutation must pass an audited RPC. **Net-tightening Â· `EXPLAIN`-neutral Â· no resolver Â· not an
  admin-arm removal**, so **D4Â·3 does not defer it**. It is M1's shape exactly.

---

## V-4 Â· Is 49 the population, or is it now a floor? â€” IT IS A FLOOR

The mandate asked me to say plainly what remains invisible to the four-arm + `prosecdef` filter. **I found a
populated blind spot, not a theoretical one.**

**The four-arm filter is textual. An RPC that reaches an admin arm *through a wrapper* carries none of the
four strings and is invisible to Q7Â·v2.** Sweeping for exactly that:

```
28 functions call an admin-arm-bearing wrapper (assert_meeting_staff_admin Â· can_read_case_or_admin Â·
can_write_interview Â· can_write_attachment Â· can_read_attachment) while matching NONE of Q7Â·v2's four arms.
Of these, 10 are SECURITY DEFINER â€” and ALL 28 have excl = f.
```

**The 10 DEFINER ones are the population Q7Â·v2 misses:** `create_attachment` Â· **`dispose_attachment_phi`** Â·
`soft_delete_attachment` Â· `open_attachment` Â· `interview_viewer_can_write` Â· `record_session_attendance` Â·
`set_interview_confidentiality` Â· `set_interview_participant` Â· `set_interview_interviewer_participant` Â·
`set_interview_subject_participant`. *(The 18 INVOKER meeting-family ones ride
`assert_meeting_staff_admin`; RLS applies, so they are A10/A13 territory, not exclusion.)*

**This is mostly, but not entirely, benign â€” and the exception is the point.** Fix the *helper* and every
DEFINER caller is fixed for free. v2 marks `can_write_interview` **FIX** â€” that propagates to the 6
interview RPCs correctly. **But v2 marks `can_write_attachment` "REMOVE-ARM (A14 to A21Â·1)" â€” arm removal
only, no exclusion deny.** From the catalog:

```
=== app.can_write_attachment (definer=true)
  when 'case' then
    v_commission := app.commission_of_case(p_owner_id);
    return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);
```

Strip `is_commission_admin_of_for` per A21Â·1 and **`is_staff_admin_of_for` survives unqualified** â€”
**verbatim the C2 defect, at the helper layer**, on a path whose DEFINER callers include
**`dispose_attachment_phi`** (PHI **destruction**) and `soft_delete_attachment`. A recused coordinator
destroys the PHI of the case she is recused from.

**Required in A0 v2:** reclassify **`can_write_attachment` to FIX** (needs the exclusion deny, not just arm
removal), and record **indirection through a gate wrapper as a THIRD binding methodology axis**, beside
`pg_policies` and `prosecdef`. **Not M1-blocking** (M1 does not touch this helper) â€” **blocking for the
Stage-A/G sweep** that does.

**Also still outside the filter and correctly to be stated as such:** `SET ROLE` / DEFINER-to-DEFINER chains
beyond one hop; arms expressed as a **`join` to `memberships`** rather than a helper call; Storage policies
(enumerated separately, Â§3.4 â€” the correct treatment). **Views are genuinely empty** (0 in `public`) and
**capability checks inside a view are therefore structurally impossible** â€” that clearance stands.

---

## V-5 Â· Sequencing sanity check (A29) â€” the order is right; the contents are not yet complete

**Durability-first is correct and I re-endorse it**, strengthened by V-1.1: the recusal arm reaches PHI too,
so M1 is a **Rule 12** migration, not merely a reach migration. B7 to mutators to sweep to A30 is right, and
**B7-before-the-mutator-fixes is right for the stated reason** (`NOT is_case_excluded(...)` is meaningless
until `is_case_respondent` resolves). **A21's admin-arm removal correctly stays out** (D4Â·3).

**Is the 35-vs-49 split defensible? â€” YES.** The 14 non-fix rows are each defensible from the catalog:
7 INVOKER (RLS applies â€” the load-bearing negative, re-verified), 3 already gated, 4 with a read gate of
which 3 are separately filed (`list_cases_board` Â§1.3, `case_viewer_capabilities` Â§3.6Â·E, `record_recusal`
C11) and 1 (`get_case_detail`) genuinely fixed for free. **The split is correct.**

**But M1's contents are incomplete for M1's own purpose** (V-3) â€” and A30's platform_admin enumeration is
**4, should be 5**. Those are the gate.

---

## V-6 Â· What M1 must cover â€” the authoritative fix set

**Once V-3 and the A30 count are folded in**, this is the list `backend` builds from. Every item pairs with
an **over-grant twin**: *the denied party calls the door on her **own** row and it **raises***, asserted on
**rows read under `set local role authenticated`** â€” never on a predicate's return value.

### M1Â·1 â€” B7: respondent linkage
Resolved state **+ the `user_id` write path** (`update_professional_profile` has no `p_user_id`) **+ a PO
ruling on `ON DELETE SET NULL`.** **Lands first.**
- **Keystone:** an `unknown` profile is linkable through the public API; `is_case_respondent` resolves `t`.

### M1Â·2 â€” the exclusion-plane mutators (5 RPCs)
`lift_recusal` Â· `remove_case_participant` Â· `set_case_participant_role` Â· `set_primary_subject` Â·
`record_recusal` â€” each gains `AND NOT app.is_case_excluded(<case>, auth.uid())` (+ the A18 Org-User arm,
pending the PO ruling).

> **THE PRECONDITION, WRITTEN NARROWLY â€” this is the part that goes vacuous if paraphrased:**
> Every keystone here **must first grant the denied principal the coordinator role**:
> - **respondent arm:** the fixture principal must be **`is_case_respondent` = t** *AND* hold
>   **`staff_admin` on the case's commission** (seed: `staff4.ccih@test.local` is `staff` â€” **the
>   membership row must be inserted by the fixture**). Without it the RPC raises `HC0E4` **for the wrong
>   reason** and the test is green and worthless.
> - **recusal arm:** the principal must be **recused** *AND* **`staff_admin`** (seed:
>   `chefe.ccih@test.local` is already `staff_admin` â€” insert the recusal only).
> - **Assert the negative on state, not on the exception alone:** after the denied call,
>   `is_case_respondent` / `is_recused_from_case` **must still be `t`** â€” the row survives her.
> - **Assert the positive twin:** a **non-excluded** coordinator calls the same door and it **succeeds** â€”
>   or the fix is an over-grant-proof that silently deleted legitimate coordinator reach.
> - **`set_primary_subject` note:** it shares the gate but `is_case_respondent` does **not** read
>   `is_primary_subject` â€” it is a co-located defect, **not** a deny-flipping one. Keystone it as a gate
>   fix, not as a durability fix, or the assertion will not falsify.

### M1Â·3 â€” NEW: `case_participant_roles` â€” the 6th exclusion-plane table (V-3)
Freeze `key` once referenced (immutability trigger â€” the `guard_case_status`/`HC025` pattern) **and/or**
`REVOKE` the direct `arwd` grant from `authenticated` so mutation must pass an audited RPC. **Add an audit
trigger** â€” this table has none and no RPC door, so today the mutation is invisible to Rule 11.
- **Keystone (over-grant twin):** `orgadmin.a@test.local`, under `set local role authenticated`, `UPDATE`s
  `case_participant_roles.key` off `respondent_doctor` gives **raises**; `app.is_case_excluded(<case>, <resp>)`
  **is still `t`**. Today this returns `UPDATE 1` and `f`.
- **Keystone (Rule 11):** the permitted path emits an `audit_log` row.
- **Keystone (no over-reach):** an `org_admin` can still **create** and **rename the `display_name` of** a
  role â€” the staffing/config surface A18 protects must survive. *(Keystone 23.)*

### M1Â·4 â€” the DEFINER exclusion sweep: 35 RPCs, split by remediation shape
- **Â§3.6Â·A â€” case-scoped, add the gate** (`AND NOT app.is_case_excluded(<case>, auth.uid())`), including
  **`set_participant_patient`** (V-6.1) and the A3 grant/staffing doors **which KEEP their arm** (C6).
- **Â§3.6Â·B â€” commission-scoped, a gate is unwritable; use a per-row filter**: `list_cases_board` (delete
  the fast-path) Â· `count_open_cases_for_board` Â· `case_tag_report` **(pending the PO ruling â€” a
  per-caller-varying count is a product decision)**.
- **Do NOT touch** the 7 INVOKER RPCs (bucket D) or the 3 already-gated ones.
- **Keystone per shape**, not per RPC: one gate-shape twin, one per-row-filter twin, plus an
  **over-reach twin** for bucket D (*an INVOKER RPC still works for a legitimate coordinator*).

### M1Â·5 â€” A30: `platform_admin` arms on tenant data â€” 5, not 4
`set_case_offered_outcomes` Â· `create_case` Â· **`dispose_referral_phi`** Â· **`can_dispose_referral_phi`**
Â· **`case_participant_roles_admin_write`** (V-3.2 â€” the `is_admin()` arm on the exclusion plane).
- **C5 CONFIRMED from the catalog** â€” `dispose_referral_phi` gates on
  `app.is_admin() OR app.is_commission_admin_of(source) OR app.is_pqs_operator_of(...)` and then
  `delete from public.referral_patient` + redacts `case_referral` / `referral_reply` /
  `referral_shared_item` / `referral_messages`. **`platform_admin` destroys referral PHI in any tenant** â€”
  a direct contradiction of CLAUDE.md Â§1's *"walled off from all tenant data."* `backend` found this; I
  missed it. **Blast radius: irreversible, cross-tenant, PHI destruction** (it *is* audited, and the
  `HC056` re-dispose guard holds).

### V-6.1 Â· `set_participant_patient` â€” CONFIRMED. Blast radius, as requested.
```
set_participant_patient(p_case_id, p_participant_id, p_name, p_mrn, p_date_of_birth, â€¦)   definer = t
  -- COORDINATOR-ONLY write gate (not can_read_case â€” that is the broad READ scope).
  if not app.is_staff_admin_of(v_case.commission_id) then raise â€¦ '42501';
  -> insert into public.patient_identifiers (â€¦) on conflict (participant_id) do update set name=â€¦, mrn=â€¦
```
**DEFINER Â· `is_staff_admin_of` only Â· no `is_commission_admin_of` arm Â· no exclusion term Â· and â€” per
V-0.3 â€” no read gate** (my v1 wrongly credited it with one).

**Blast radius:** a **recused coordinator**, or a **respondent-coordinator**, **writes and silently
overwrites patient identity** (`name`, `mrn`, `date_of_birth`, `sex`, `encounter_ref`, `unit`,
`attending`) on any case in her commission â€” via `on conflict do update`, i.e. **destructive of existing
PHI**, not merely additive. It auto-creates the participant chain and flips `cases.has_patient`. It is a
**Rule 12 write/tamper door on the evidentiary record of the case in which she is the accused** â€” the
integrity mirror of the read door in PROBE 3. Because it carries **no `is_commission_admin_of` arm**,
A21's arm removal **never touches it**: only the exclusion gate closes it. **`backend` found this; both
prior sweeps missed it. Correctly filed in Â§3.6Â·A2.**

---

## V-7 Â· Required edits to A0 v2 (all mechanical â€” no redesign)

| # | Required | Why blocking |
|---|---|---|
| **1** | **Add `case_participant_roles` to the exclusion plane** (Â§1.1 table + Â§4.1). **Correct C8's disproof: it holds for 5 tables, and Rule 11 does NOT hold on the 6th.** State the direct-DML door + the missing audit trigger. | **M1's purpose fails without it** (V-3). A27 is binding and A0 v2 does not apply it to its own join. |
| **2** | **A30 enumeration: 4 to 5** platform_admin arms (add `case_participant_roles_admin_write`). | A30 requires the enumeration be **exhaustive**; it is not. |
| **3** | **Reclassify `can_write_attachment` REMOVE-ARM to FIX** (Â§3.5). | The C2 defect at the helper layer, on **`dispose_attachment_phi`** (PHI destruction). *(Not M1; blocks the Stage-A/G sweep.)* |
| **4** | **State plainly that 49 is a FLOOR**, and add **indirection through a gate wrapper** as a third binding methodology axis (28 fns, 10 DEFINER â€” list them). | v2 presents 49 as the population. It is the third floor this program has mistaken for one. |
| **5** | **Correct the `lift_recusal` severity narrative** (V-1.1) â€” it flips `can_read_case_patient` too; the respondent arm is **not** "strictly worse". Both arms are PHI doors; the PO ruling is a Rule 12 decision. | The PO is ruling on this; the framing understates what is being decided. |
| **6** | **Re-word `is_admin()`'s JWT claim** (Â§1.6) â€” a **server-minted cache** (`custom_access_token_hook`, ADR 0002), **not** a forgeable escalation path. Residual = **staleness** only. | Lead correction; must not ship as a privilege-escalation finding. |
| **7** | Record the **narrow preconditions** (V-6Â·M1Â·2) in Â§6 so no keystone can go green asserting nothing. | C1a's own lesson, applied to every fixture in the migration. |

**What does NOT need to change:** the methodology (now the strongest in the program), the provenance
discipline, **all five accepted corrections C2/C3/C6/C7/C9â€“C12**, the KEEP list, the INVOKER negative, the
`prosecdef` axis, the gates-vs-filters split, the 35/49 partition, the sequencing order, and C8's three
legs **as scoped**.

## V-8 Â· PO / lead rulings still open
Unchanged from v2 Â§5.1 (1â€“6), **plus**: **(7)** who may mutate `case_participant_roles.key` once a case
references it â€” and is `key` immutable-once-referenced? **(8)** `platform_admin` and **referral PHI
destruction** (A30 / `dispose_referral_phi`) â€” the sharpest form of the CLAUDE.md Â§1 contradiction.

---

## Summary â€” v2

| | |
|---|---|
| **Verdict** | **CHANGES REQUESTED** |
| **Sufficient foundation for M1's SQL?** | **No** â€” by one item (V-3) + the A30 count. Everything else is ready. |
| v2 corrections **verified** | **C1a Â· C2 Â· C3 Â· C4 Â· C5 Â· C6 Â· C7 Â· C9â€“C12 all CONFIRMED Â· C8 legs CONFIRMED / scope FAILS** |
| v2 probes re-run by me | **3/3 reproduce exactly, preconditions included** |
| **My v1 errors, corrected visibly** | **3** â€” the vacuous fixture (C1a) Â· the "30" floor (C4) Â· the `readgate` comment false-positive (V-0.3) |
| New findings | **1 x P0 proven live** (`case_participant_roles`, V-3) Â· **1 x P1** (`can_write_attachment` misclass, V-4) Â· **1 x severity** (`lift_recusal` is a PHI door, V-1.1) |
| Over-reach in v2 | **0** â€” Â§3.7's claim verified in both directions |
| Blind spot remaining | **indirection through a gate wrapper** (28 fns / 10 DEFINER) |
| Re-review | **Fast** â€” 7 mechanical edits; no redesign |

**Credit, and it is not a formality.** v2 did the thing this program keeps failing to do: it **re-ran
someone else's fixture and disproved it**, and it corrected its own author's classification error against
its own prior conclusion. It caught **two** real errors in my review and I have conceded both plus a third
it did not catch. Its `set_participant_patient` and `dispose_referral_phi` finds are doors **both** prior
sweeps walked past.

**And the gate still fails â€” for the same reason, one turn further out.** v1 applied its A22 lens to
policies but not to its RPC list. I condemned the blind-spot query and then re-ran it. v2 published A27's
binding rule â€” *enumerate every mutator of every row the deny reads* â€” and did not apply it to the second
table in `is_case_respondent`'s own join. **The rule keeps being right and the author keeps being its blind
spot.** The standing rule `backend` proposed is the correct response, and it should extend past probes to
**scopes**: the party who *draws* the boundary of a sweep should not be the only party who *checks* it.


---
---

<a name="v3-review--the-final-a0-round"></a>

# PART III â€” v3 review Â· the final A0 round

**Date:** 2026-07-15 Â· **Reviewer:** `qa` Â· **Subject:** `docs/progress/authz-capability-inventory.md` **v3**
**Method:** live catalog only â€” `pg_proc` (incl. `prosecdef`, `prosqlbody`, `prolang`), `pg_policies`,
`pg_class.relacl`, `pg_depend`, `pg_trigger`, `pg_auth_members`,
`information_schema.role_{table,column}_grants`. **No file text, no grep, no graphify.** Stack owned by the
lead â€” no reset/restart/push. **Five probes re-run, each `ROLLBACK`ed; persistence re-verified.**

> **On the graphify hook:** it fired again and I again did not follow it, and I state why rather than
> ignoring it silently: **graphify does not index SQL**, and this program's binding finding is that **file
> text is stale** (migrations rewrite `pg_proc` bodies). It cannot answer a single question in this
> mandate. The lead has ratified this exception for A0. *(Recommend the hook be scoped to exclude
> catalog-methodology work, or it will keep firing against a ratified exception.)*

# VERDICT: âœ… **APPROVED**

**Is A0 v3 sufficient to author M1's SQL against? â€” YES, for M1Â·1â€“M1Â·4, which is the durability core and
the whole of the PO-approved sequencing that matters. M1Â·5 (A30) needs one more mechanical sweep, which I
have run below and hand over rather than bounce.**

**A0 is CLOSED.** Every v3 claim I tested reproduced. Its central move â€” **stop counting callers; enumerate
the gate helpers** â€” is not just pragmatic, it is **provably closed**, and I give the closure argument in
Â§W-2 because v3 states the conclusion without stating the proof. **It corrected me twice more and both
corrections stand.** The two gaps I found are **additive scope items, not method failures** â€” and per this
mandate the authoritative M1 list is mine to state, so I have folded them in (Â§W-6) rather than spend a
sixth round on them.

---

## W-0 Â· Corrections to my own v2 â€” the fourth round of the same lesson, and it is mine again

### W-0.1 Â· âœ… **D2 CONFIRMED. My PROBE 4 over-stated the blocker.** (v2 Â§V-3.3 is WRONG)

I re-ran it. **v3 is right:**

```
 BEFORE                                | respondent t | excluded t | can_read f | can_read_phi f | audit 160
 org_admin, authenticated: update case_participant_roles set key='former_respondent'  â†’ UPDATE 1
 AFTER (re-key ALONE, no positive arm) | respondent f | excluded f | can_read f | can_read_phi f | audit 160
```

**`can_read_case_patient` stays `f`. So does `can_read_case`.** My V-3.3 wrote that the re-key dissolves
*"`can_read_case_patient`'s deny, i.e. **PHI on every ethics case in the org**."* **I never measured it.** I
measured `respondent` and `excluded`, then *asserted* the PHI consequence â€” one section after I had
established, against my own v1, that **the positive arm is the precondition**.

**Removing a deny is not granting access.** I fixed exactly this precondition for PROBE 3 and dropped it
for PROBE 4, **inside my own new blocker, in the same document**. That is C1a's lesson for the **fourth**
consecutive round, and the second time it is mine. It is the strongest possible argument for standing
rule 1, and `backend` has now been the beneficiary of it twice.

### W-0.2 Â· âœ… **D2a CONFIRMED â€” exactly, including the audit claim, which is the sharpest in the document**

PROBE 5 re-run with the precondition. **It reproduces to the row:**

```
 BEFORE                                      | respondent t | excluded t | can_read f | can_read_phi f | audit 161
 -- the ORG_ADMIN acts.  THE RESPONDENT DOES NOTHING AT ALL.
 org_admin, authenticated: update case_participant_roles set key='former_respondent'  â†’ UPDATE 1
 AFTER (org_admin acted; respondent passive) | respondent f | excluded f | can_read t | can_read_phi t | audit 161
 POST-ROLLBACK | key='respondent_doctor' | audit 160 | staff_admin_rows 4        â† nothing persisted
```

**161 â†’ 161 holds.** The `160 â†’ 161` step is the fixture's own `memberships` insert emitting its audit row;
the **org_admin's direct DML emits none**. So the composed path is **neither preventable nor detectable** â€”
and `backend` is right that this is **worse** than I framed it, on the axis I did not look at:
**`remove_case_participant` at least leaves a row; this leaves nothing, and the respondent never acts.**
There is no collusion signal because there is no record.

**And v3's blast-radius split is the correction that makes the keystone writable** â€” I collapsed it:
- **deny dissolution: ORG-WIDE** (one shared role row â†’ every case in the org at once) âŸµ why it is P0
- **PHI consequence: PER-RESPONDENT** (gated on that respondent's positive arm) âŸµ why the keystone must be narrow

Conflate them and the keystone asserts an org-wide PHI read that does not exist, fails to reproduce, and
gets "fixed" by weakening the assertion. **Both halves are now in the keystone (Â§W-6Â·M1Â·3).**

### W-0.3 Â· âœ… **D4 CONFIRMED â€” my "10 DEFINER" was itself a floor**

I matched **five hand-picked wrapper names** â€” which is hand-picking the arms one level up, the same error
one layer out. v3's closure swept in every PHI door I missed. **Conceded.**

### W-0.4 Â· âœ… **D1a CONFIRMED â€” v3's self-criticism is right, and sharper than my finding**

The deny's true read set, from `prosrc`:

```
 proname              | conflict_decls | participant_roles | participants | recusals | prof_profiles | prof_participants
 is_case_excluded     | f              | f                 | f            | f        | f             | f
 is_case_respondent   | f              | t                 | t            | f        | t             | t
 is_recused_from_case | f              | f                 | f            | t        | f             | f
```

**Exactly five tables â€” and `case_conflict_declarations` is `f` on all three.** v2 swept five and got the
**right cardinality with the wrong membership**: it omitted `case_participant_roles` *and* included a table
the deny never reads. **The two errors cancelled â€” which is precisely why the sweep looked complete.** I
said the boundary was wrong; v3 showed *why it was invisible*. That is a better finding than mine and it is
the proof of my own standing-rule extension.

---

## W-1 Â· D3 â€” the lead's instruction was wrong, and v3 disproved it with evidence. âœ… **CONFIRMED**

```
 app_public_fns | plpgsql | sql_lang | with_parsed_prosqlbody
            660 |     509 |      151 |                      0
 fn_to_fn_edges
              5
```

**Exact.** Every function uses an old-style string-literal body (`AS $$ â€¦ $$`); PostgreSQL records
dependencies only for new-style `BEGIN ATOMIC` bodies (`prosqlbody`), of which there are **zero**. The 5
edges are argument/return-type dependencies, not calls. **There is no call graph in `pg_depend` to close
over.**

> **Recorded for the lead, as requested: the instruction is unachievable and NO future round should be sent
> down that path.** `backend` was right to refuse it and right to bring evidence rather than comply. This is
> [[verify-dont-comply]]'s third instance in this program â€” and the first where the *lead* was the source.

---

## W-2 Â· â›”â†’âœ… **THE LOAD-BEARING CLAIM: is the gate-helper set really closable?**

I drew none of this boundary. Here is what I checked.

### W-2.1 Â· The numbers â€” âœ… **exact**

Q19 re-run verbatim: **16 helpers Â· 5 carry the deny Â· 11 do not Â· 48 callers** (18+9+8+4+3+2+1+1+1+1+0).
Every cell reproduces.

### W-2.2 Â· **Is 16 the population, or a sixth floor? â€” It is a SCOPED set, not a derived one â€” and the scope holds.**

**v3's Q19 is a hand-written `IN` list of 16 names. There is no derivation rule.** That is a boundary drawn
by judgement â€” the exact thing the last five rounds got wrong â€” and v3 does not say so. **So I derived it
by a rule instead:** every `app` function returning `boolean`/`void`/`uuid` that carries a role arm **and**
has â‰¥1 function or policy caller.

**Result: 23 arm-bearing helpers exist outside v3's 16.** But the scope holds, and here is why:

| Outside the 16 | Verdict |
|---|---|
| `can_read_event` Â· `can_read_event_patient` Â· `can_write_rca` Â· `can_write_capa` Â· `can_read_capa` Â· `can_curate_pqs_vocab` Â· `is_pqs_operator_of` Â· `can_sign_meeting` Â· `can_sign_section` Â· `can_read_signoff` Â· `can_read_document_*` Â· `can_read_xref_row` Â· `is_pqs_writer_of` Â· `event_current_custodian` Â· `can_write_action_item_stake` Â· `can_manage_referral_*` | **Other domains** (NSP/PQS Â· RCA/CAPA Â· documents Â· signoffs). Not the case-content plane. **Correctly out of scope.** |
| `is_commission_admin_of` Â· `audit_write` Â· `_audit_access_authorized` | **Not gate helpers** â€” the arm itself / the audit writer. **Correctly out.** |
| **`can_read_professional_profile`** | Touches `professional_profiles` â€” a **deny-read table**. But its case arm gates on **`app.can_read_case`, which carries the deny** âœ…. Its `is_admin()` arm is an **A30 item** (Â§W-4). **Not a deny hole.** |
| **`can_manage_professional`** | `is_admin() OR is_org_admin_of OR staff_admin-in-org`, **no deny, no case scope**. But `user_id` is **write-once** and `update_professional_profile` never writes it, so **it cannot flip the deny** âœ…. **Not on the exclusion plane.** Its `is_admin()` arm is an **A30 item.** |

**Conclusion: 16 is sound for the case plane. It is not a floor â€” but v3 must WRITE DOWN the scoping rule**
(*"gate helpers of case/meeting/attachment/interview/referral content"*), because a hand-written `IN` list
with no stated rule is indistinguishable from the five boundaries that were wrong. *(Documentation, not
defect â€” folded into Â§W-6.)*

### W-2.3 Â· â­ **Does fixing a helper fix its callers? â€” YES, and the closure argument is stronger than v3 states**

v3 asserts *"fix the 11 and all 48 callers are fixed for free"* and leaves it there. **The proof it does not
give is the reason to approve:**

> **The partition is exhaustive by construction.** Every function either **carries an arm string** â€” in
> which case it is **text-findable**, because the string is literally in `prosrc` â€” or **it does not**, in
> which case its only route to an arm is **through a helper**, and fixing the helper fixes it. There is no
> third case. **The transitive caller set does not need to be closable, because it is not the population â€”
> the union `{gate helpers} âˆª {direct-arm-checkers}` is, and both halves are mechanically derivable.**

That is why the 37â†’30â†’35/49â†’10â†’57 regress ends here, and it ends for a **structural** reason, not a
pragmatic one. **D5 is correct and I endorse it as the frame.**

### W-2.4 Â· âš  **But the "for free" claim has NINE exceptions, and v3 states none of them**

A caller that **also checks a role directly** short-circuits the helper and is **not** fixed for free:

```
 helper                | caller                          | also_checks_role_directly
 can_read_action_item  | app.can_read_attachment         | t
 can_read_action_item  | app.can_write_action_item_stake | t
 can_read_attachment   | app._audit_access_authorized    | t
 can_read_referral     | public.get_referral_detail      | t
 can_read_referral_phi | app._audit_access_authorized    | t
 can_read_referral_phi | public.get_referral_detail      | t
 can_read_referral_phi | public.post_referral_message    | t
 can_write_attachment  | public.reclassify_attachment    | t     â† NOT covered anywhere
 can_write_interview   | app.can_write_attachment        | t
```

**Eight are already covered** â€” `get_referral_detail` / `post_referral_message` are in the 35; the rest are
helpers in the set themselves (nested, fixed by their own fix). **One is not: `reclassify_attachment`.**

### W-2.5 Â· â›” **`reclassify_attachment` â€” a real defect v3's frame does not reach** (the direct-check residue)

```
=== public.reclassify_attachment   definer = true
  -- Directional authz: declassify (phiâ†’standard) is staff_admin/org-admin only.
  if p_new_tier = 'standard' and v_row.sensitivity_tier = 'phi' then
    if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
      raise exception 'apenas a coordenaÃ§Ã£o pode reduzir a classificaÃ§Ã£o de um anexo' using errcode='42501';
  else
    if not app.can_write_attachment(...) then â€¦          â† this arm IS fixed by the helper fix
  â€¦
  update public.attachments
     set sensitivity_tier = p_new_tier,                  -- 'phi' â†’ 'standard'
         storage_bucket   = v_new_bucket,                -- 'attachments-phi' â†’ 'attachments'
         confidentiality_label = v_new_label;            -- 'phi_standard' â†’ 'non_phi_internal'
```

**The declassify arm checks the role directly â€” no deny, no exclusion.** A **recused coordinator** (or a
**respondent-coordinator**) **declassifies a PHI attachment** on the case she is excluded from: it moves
buckets `attachments-phi â†’ attachments` and its label is rewritten to `non_phi_internal`, which **drops it
below `attachment_confidentiality_ok`'s ceiling** and into the broader-read bucket. **Rule 12 downgrade.**

**Why both sweeps missed it â€” and this is the actionable lesson:** Q7Â·v2's *content* predicate has no
`attachments` term, so `reclassify_attachment` was never in the 49; and it checks directly, so the helper
fix never reaches it. **The direct-check-door set must be derived without the hand-written content filter.**
Superset from the catalog: **89** DEFINER `public` functions carry an arm and no deny; **50** sit outside
v3's 35+4. Most are genuinely other domains (indicators Â· controlled documents Â· dashboards Â· committee
action items Â· NSP) or KEEP-list config â€” **`reclassify_attachment` is the one that plainly belongs to this
program's surface.** *(I am not filing the other 49 as findings; I am handing over the derivation so the
content filter stops being the residual judgement call.)*

**This is additive, not a redesign, and it does not defeat M1's purpose** (it is not on the exclusion
plane). **Folded into M1Â·4 (Â§W-6) rather than bounced.**

### W-2.6 Â· The 57 false alarms â€” spot-checked **both ways** âœ…

v3 caught its own false alarms and I checked the self-correction in the direction that matters â€” **did it
wrongly clear a real defect?**

- `get_case_patient` â†’ `get_participant_patient` â†’ **does** gate on `can_read_case_patient` âœ… correctly cleared
- `get_referral_patient` â†’ gates on `can_read_referral_phi` âœ… correctly cleared
- **`save_narrative_body` â†’ gates on `can_write_case_narrative`** â€” v3 cleared the *caller* âœ… **and then
  correctly filed the *helper* as D6.** That is the self-correction working in both directions in one step.

**No real defect was wrongly cleared in the sample.** The clearances are sound because they are
helper-delegations â€” which is exactly D5's point.

---

## W-3 Â· D6 â€” âœ… **CONFIRMED. Blast radius as requested.**

```
=== app.can_write_case_narrative   definer = true
  return
    app.is_staff_admin_of_for(v_commission, p_uid)          â† NO DENY. Short-circuits everything below.
    or (v_assigned_to is not null and v_assigned_to = p_uid)
    or (v_assigned_to is null and app.can_write_case_content(v_case_id, p_uid));   â† this arm HAS the deny
```

**The helper is internally inconsistent, which is the sharpest form of the defect:** its **third** arm
delegates to `can_write_case_content`, which **carries the deny** â€” so the function already "knows" the
excluded must be denied â€” while its **first** arm grants a recused coordinator write **before that arm is
ever evaluated**.

**`case_narratives.body_md`, from its own column comment:**
> *"PHI-BEARING free text (WS B; Rule 11/12). Case narrative prose (sanitized Markdown, Rule 7)â€¦"*

**Blast radius:** a **recused coordinator** or a **respondent-coordinator** **writes and overwrites
PHI-bearing narrative prose** on the case in which she is recused or accused â€” the deliberative record of
an ethics case, authored by its subject. Sole caller `save_narrative_body` (DEFINER) **does not check a
role directly** (verified) â‡’ **fixing the helper fixes it for free**, no RPC edit needed. Invisible to
Q7Â·v2 (the RPC carries no arm string) **and** to my wrapper sweep (not among my five hand-picked names).
**`backend` found this; I did not. It is the best find in v3.**

---

## W-4 Â· A30 â€” âš  **the enumeration is NOT exhaustive, and A30 demands that it be**

A30's own words: *"`backend` must **first** enumerate **every** platform_admin arm on tenant data; this is
unlikely to be the only one."* **v3 says five.** The catalog says **42 `is_admin()` sites** (20 functions +
22 policies). Most are legitimate platform surface â€” `organizations` Â· `hospitals` Â· `profiles` Â·
`commissions` Â· `grant_role`/`revoke_role` Â· `verify_audit_chain` Â· config tables â€” **but a material
tenant-data subset is unlisted:**

| Unlisted site | Why it is tenant data |
|---|---|
| **`app.can_read_professional_profile`** | `if is_admin() then return true` â‡’ reads **Class-2 professional identity** (Rule 12, ADR 0064/0065) in **every** tenant |
| **`app.can_manage_professional`** | `is_admin()` arm â‡’ manages professional identity org-wide |
| **`app.attachment_confidentiality_ok`** Â· **`app.confidentiality_clearance_ok`** | the **confidentiality ceiling itself** â‡’ platform_admin bypasses the ceiling on case attachments + interviews |
| `public.participants.participants_select` (policy) | `participants` includes **patient** participants |
| `public.dashboard_distributions` Â· `dashboard_export_rows` | tenant form/response data |
| `public.hospital_document_register` Â· `hospital_indicator_rollup` | tenant governance data |

**This does not block M1Â·1â€“M1Â·4** â€” A30 is the **last** step in A29's sequence and is a **PO fold-in**, not
a durability item. But **M1Â·5 cannot be authored against "five"**: it would ship a keystone asserting
*platform_admin is walled off from tenant data* while the ceiling helpers and Class-2 identity still carry
the arm. **The sweep above is the input; `backend` classifies each site platform-surface vs tenant-data and
the PO rules.** Mechanical, and I have done the catalog half.

---

## W-5 Â· M1Â·3's fix shape â€” âœ… **UPDATE-freeze CONFIRMED; the premise is TRUE**

```
                fn                | inserts | updates | deletes
 app.is_case_respondent           | f       | f       | f
 public.add_case_participant      | f       | f       | f
 public.set_case_participant_role | f       | f       | f
 public.set_participant_patient   | t       | f       | f        â† the ONLY writer, and it INSERTs
```

**Verified in both directions:**
- **A blanket write-freeze WOULD break a live path** â€” `set_participant_patient` INSERTs the
  `affected_patient` role row (`on conflict (organization_id, key) where case_type_id is null do nothing`)
  on the ADR-0038 arg-only patient path. v3 is right; a write-freeze breaks patient registration.
- **"No RPC ever UPDATEs `key`" is TRUE** â€” **0 functions UPDATE `case_participant_roles`, and 0 DELETE
  it.** So an **UPDATE-freeze costs nothing** and is free of live-path risk.

**v3's fix-shape correction is right.** *(Note for M1: the freeze should target `key` specifically â€”
`display_name` must stay updatable, or A18's staffing/config surface breaks. That is the over-reach twin.)*

---

## W-6 Â· â­ THE AUTHORITATIVE, ORDERED M1 SCOPE â€” `backend` builds from THIS

v3's Â§6 with my two corrections folded in. **Order is binding** (A29, PO-approved).

### M1Â·1 â€” B7: respondent linkage Â· **LANDS FIRST**
Resolved state **+ the `user_id` write path** (`update_professional_profile` has no `p_user_id` â‡’ `unknown
â†’ linked` has no door) **+ the `ON DELETE SET NULL` PO ruling**.
**Why first:** every fix below is `AND NOT app.is_case_excluded(...)`, which is **meaningless until
`is_case_respondent` resolves**. The other order produces a gate that passes for the very principal it must deny.
- **Keystone:** an `unknown` profile is linkable through the public API; `is_case_respondent` â†’ `t`.

### M1Â·2 â€” the five exclusion-plane **RPC** mutators
`lift_recusal` Â· `remove_case_participant` Â· `set_case_participant_role` Â· `set_primary_subject` Â·
`record_recusal` â€” each gains `AND NOT app.is_case_excluded(<case>, auth.uid())` (+ the A18 Org-User arm,
pending the PO ruling).

> **PRECONDITION â€” WRITTEN NARROWLY. This is the part that goes vacuous if paraphrased.**
> - **respondent arm:** the principal must be **`is_case_respondent` = t** **AND** hold **`staff_admin` on
>   the case's commission**. Seed `staff4.ccih@test.local` is **plain `staff`** â€” **the fixture MUST insert
>   the membership row.** Without it the RPC raises `HC0E4` **for the wrong reason** and the test is green
>   and worthless. *(C1a â€” proven twice.)*
> - **recusal arm:** the principal must be **recused AND `staff_admin`** (`chefe.ccih@test.local` is
>   already `staff_admin` â€” insert the recusal only).
> - **Over-grant twin (each):** the denied party calls the door **on her own row** â†’ **RAISES**; and
>   `is_case_respondent`/`is_recused_from_case` **is still `t`** â€” assert the **row survives her**, on rows
>   read under `set local role authenticated`, never on a predicate's return value.
> - **Positive twin (each):** a **non-excluded** coordinator calls the same door â†’ **SUCCEEDS**. Without
>   this the fix may have silently deleted legitimate coordinator reach. *(Keystone 23.)*
> - **`set_primary_subject`:** shares the gate but `is_case_respondent` does **not** read
>   `is_primary_subject` â‡’ keystone it as a **gate fix**, not a durability fix, or it cannot falsify.
> - **Both arms are Rule 12 doors** (D9) â€” `lift_recusal` flips `can_read_case_patient` too. Assert **PHI**,
>   not just reach.

### M1Â·3 â€” `case_participant_roles`: the 6th exclusion-plane table Â· **UPDATE-freeze**
**`UPDATE`-freeze on `key`** (immutability trigger, the `guard_case_status`/`HC025` pattern) â€” **NOT a
write-freeze** (breaks `set_participant_patient`'s INSERT, Â§W-5) â€” **and/or** `REVOKE` the direct `arwd`
grant so mutation passes an audited RPC. **Add an audit trigger:** the table has **0** and **no RPC door**,
so today the mutation is invisible to Rule 11.

> **Keystones â€” the two halves must be asserted separately or the test is vacuous (Â§W-0.2):**
> - **(a) org-wide dissolution:** `orgadmin.a@test.local`, under `set local role authenticated`, `UPDATE`s
>   `case_participant_roles.key` off `respondent_doctor` â†’ **RAISES**; `app.is_case_excluded(<case>,<resp>)`
>   **is still `t`**. *(Today: `UPDATE 1`, then `f`.)*
> - **(b) per-respondent PHI â€” needs the FULL composed precondition:** respondent **AND `staff_admin`**
>   (M1Â·2's precondition) **AND** the actor is the **org_admin**, **AND the respondent never acts**. Assert
>   `can_read_case_patient` **stays `f`**. *(Today: `t`.)* **Do not assert PHI on (a) alone â€” it is `fâ†’f`
>   and the test will "pass" while asserting nothing. That is exactly my v2 error.**
> - **(c) audit silence:** the permitted path emits an `audit_log` row. *(Today: 161â†’161 â€” none.)*
> - **(d) over-reach twin:** an `org_admin` can still **create** a role and **rename `display_name`** â€”
>   A18's staffing/config surface must survive.

### M1Â·4 â€” the sweep: **35 RPCs + `reclassify_attachment`**, split by remediation shape
- **Â§3.6Â·A â€” case-scoped â†’ add the gate** `AND NOT app.is_case_excluded(<case>, auth.uid())`. Includes
  **`set_participant_patient`** (PHI write/overwrite) and the A3 grant/staffing doors **which KEEP their
  arm** (C6 â€” *keeping the arm* and *adding the deny* are orthogonal).
- â¬… **NEW: `reclassify_attachment`** (Â§W-2.5) â€” its **declassify arm** checks the role **directly**, so the
  helper fix does **not** reach it, and Q7Â·v2's content filter never saw it.
  **Keystone:** a recused coordinator calls `reclassify_attachment(phiâ†’standard)` â†’ **RAISES**; the
  attachment stays in `attachments-phi` with its label intact. **Positive twin:** a non-excluded
  coordinator still declassifies.
- **Â§3.6Â·B â€” commission-scoped â†’ a gate is UNWRITABLE; use a per-row filter**: `list_cases_board` (delete
  the fast-path) Â· `count_open_cases_for_board` Â· `case_tag_report` *(pending the PO ruling â€” a
  per-caller-varying count is a product decision)*.
- â›” **DO NOT TOUCH** the 7 INVOKER RPCs (RLS applies â€” the load-bearing negative, re-verified twice) or
  the 3 already-gated.
- **Keystone per shape**, not per RPC: one gate twin Â· one per-row-filter twin Â· one **over-reach twin for
  bucket D** (*an INVOKER RPC still works for a legitimate coordinator*).

### M1Â·4b â€” the **11 gate helpers** (D5) â€” *this is where the leverage is*
Fix the 11 â†’ **48 callers fixed for free** (closure argument: Â§W-2.3). Priority order:
1. **`can_write_case_narrative`** â­ (D6) â€” **FIX**: a recused coordinator writes **PHI-bearing** prose. 1 caller.
2. **`can_write_attachment`** (D7) â€” **FIX**: callers include **`dispose_attachment_phi`** (PHI destruction). 4 callers.
3. **`can_write_interview`** â€” **FIX**: no deny, no `is_active` on the interviewer arm. 8 callers.
4. **`can_read_action_item`** â€” **FIX** (A22 + A24Â·5). 3 callers.
5. `can_read_attachment` (REMOVE-ARM Ã—2) Â· `assert_meeting_staff_admin` (REMOVE-ARM, A10; 18 INVOKER meeting RPCs) Â· `can_read_referral_phi`/`can_read_referral` (split, D7/F-min) Â· `attachment_confidentiality_ok` + `confidentiality_clearance_ok` (**B3 must repoint BOTH** â€” Â§1.8).
- **Keystone per helper**, asserted **at a caller** (not on the predicate): the excluded party's call raises;
  the non-excluded party's call succeeds. **Plus the `can_write_case_narrative` self-consistency assertion:**
  its arm-1 and arm-3 must now agree.
- âš  **STATE IT IN Â§6 SO M1 IS NOT MISREAD:** *"fix 11 helpers and we're done"* **ships with the P0s
  intact.** The self-serving mutators check `is_staff_admin_of` **directly** â€” the helper fix **never
  touches them**. **M1 = helpers âˆª direct-check doors.** Both are required; neither is sufficient.

### M1Â·5 â€” A30: platform_admin arms Â· âš  **BLOCKED pending an exhaustive enumeration** (Â§W-4)
**Do not author against "five."** Complete the enumeration first (my sweep is the input: 42 `is_admin()`
sites â€” 20 fns + 22 policies), classify each **platform-surface vs tenant-data**, and get the **PO ruling**.
Known-unlisted tenant-data arms: **`can_read_professional_profile`** Â· **`can_manage_professional`** Â·
**`attachment_confidentiality_ok`** Â· **`confidentiality_clearance_ok`** Â· `participants_select` Â·
`dashboard_distributions` Â· `dashboard_export_rows` Â· `hospital_document_register` Â·
`hospital_indicator_rollup`. **Last in the sequence â‡’ does not block M1Â·1â€“M1Â·4 from starting now.**

---

## W-7 Â· Non-blocking corrections for the record (fold into Â§6; do not spend a round on them)

| # | Item |
|---|---|
| 1 | **Write down D5's scoping rule** â€” *"gate helpers of case/meeting/attachment/interview/referral content."* A hand-written `IN` list with no stated rule is indistinguishable from the five boundaries that were wrong (Â§W-2.2). |
| 2 | **State the closure argument** (Â§W-2.3). It is the justification for the whole frame and v3 asserts the conclusion without it. |
| 3 | **State the 9 sole-gate exceptions** (Â§W-2.4) â€” *"fixed for free"* is true **except** where a caller also checks a role directly. |
| 4 | **Add `reclassify_attachment` to M1Â·4** and note that the direct-check set must be derived **without** the hand-written content filter (Â§W-2.5). |
| 5 | **A30: five â†’ not-yet-exhaustive** (Â§W-4). |

---

## Summary â€” v3

| | |
|---|---|
| **Verdict** | âœ… **APPROVED â€” A0 is CLOSED** |
| **Sufficient to author M1's SQL against?** | **YES for M1Â·1â€“M1Â·4** (the durability core). **M1Â·5 (A30) blocked** on an exhaustive enumeration â€” last in sequence, does not gate the rest. |
| v3 claims verified | **D1 âœ… Â· D1a âœ… Â· D2 âœ… Â· D2a âœ… (incl. 161â†’161) Â· D3 âœ… (0/660, 5 edges) Â· D4 âœ… Â· D5 âœ… (16/5/11/48 exact) Â· D6 âœ… Â· D7â€“D10 âœ… Â· M1Â·3 UPDATE-freeze âœ…** |
| Probes re-run by me | **5/5 reproduce exactly**, preconditions included |
| **My v2 errors, corrected visibly** | **2** â€” PROBE 4's unmeasured PHI claim (D2) Â· the "10 DEFINER" floor (D4) |
| New findings | **1** â€” `reclassify_attachment` (direct-check residue, Rule 12 downgrade) Â· **1 scope gap** â€” A30's enumeration |
| Over-reach found | **0** |
| Method | **Closable at last.** `{gate helpers} âˆª {direct-arm-checkers}` is exhaustive **by construction** (Â§W-2.3). |

**Why this closes.** Five rounds each found a real P0, and the temptation is to assume a sixth exists. It
does not â€” not because we stopped looking, but because **the frame changed from one that could not close to
one that can**. Every prior round enumerated *call sites* and produced a floor (37 â†’ 30 â†’ 35/49 â†’ 10 â†’ 57)
because *"is this caller gated?"* is a judgement no filter makes. **D5's partition is mechanical and
exhaustive**, and the two gaps I found are **inside** it â€” one direct-check door and one incomplete
enumeration â€” both derivable by rule, both folded into Â§W-6 rather than bounced. **That is the difference
between a floor and a boundary.**

**On the record, plainly:** the last two rounds, the person who was wrong was **me** â€” an unverified PHI
claim inside my own blocker, and a hand-picked wrapper list I condemned in others. `backend` caught both by
re-running my fixtures. **The standing rules earned their place: probes re-run by someone who didn't write
them (4/4 rounds found something), and boundaries checked by someone who didn't draw them (D1a is its
proof â€” right cardinality, wrong membership).** Both should outlive this program. And **D3 should be
recorded as the round where the lead's instruction was the thing that was wrong, and `backend` brought
evidence instead of compliance.** That is the behaviour to keep.

