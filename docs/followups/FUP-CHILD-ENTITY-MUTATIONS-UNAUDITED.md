# FUP-CHILD-ENTITY-MUTATIONS-UNAUDITED — ~25 child/vocabulary tables emit no audit row on any mutation (owner: backend/PO)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> Filed 2026-08-27 by AE1 close condition #3, the [tier-1 threat review](../design/authz-ae1-tier1-threat-review.md)
> §4.3 (finding F-T1-3). **Architecture Rule 11 says every mutation emits a row.**
>
> **62** of the 270 mutating Tier-1 DEFINER doors write tables that emit nothing by **either**
> audit mechanism — neither a call reaching `audit_write` anywhere in the door's closure, nor a
> `trg_audit_*` trigger on the table itself (108 doors take the first path, 100 the second; 54
> tables carry an audit trigger).
>
> The affected tables are a coherent class — **child entities and vocabulary**: `rca_factors` ·
> `rca_members` · `rca_root_causes` · `rca_timeline_entries` · `rca_evidence` · `rca_why_chains` ·
> `capa_action` · `capa_action_task` · `capa_action_evidence` · `capa_measure` ·
> `capa_measure_result` · `case_interview_interviewers` · `case_interview_subjects` ·
> `case_tag_assignments` · `case_assignment_roles` · `referral_shared_item` ·
> `referral_requested_actions` · `pqs_event_types` · `pqs_sentinel_criteria` ·
> `ethics_allegation_categories` · `ethics_sanction_types` · `hospital_departments` ·
> `case_correction_requests` · `interview_session_attendance` · `upload_sessions`/`file_objects`.
>
> ⭐ **The parents are audited and the children are not.** `app.trg_audit_rca` exists;
> `rca_factors` carries only `guard_rca_child_lock`. A child insert never touches the parent
> row, so no parent audit row is emitted for it either — the coverage does not flow downward.
>
> **Evidence hierarchy, so it is not re-litigated:** the catalog is decisive (no audit trigger,
> no `audit_write` in closure). `audit_log` corroborates — `entity_type` holds `rca`,
> `capa_plan`, `interview` but no child type — and is **only** corroboration, because on a
> seeded database an absent row can mean "the path was never exercised".
>
> ⛔ **This needs a PO reading before it needs a migration:** does Rule 11's *"every mutation"*
> mean every row in every table, or every **aggregate** (the parent RCA / CAPA / interview)? The
> answer decides whether this is ~25 audit triggers plus entity-type and diff decisions, or a
> documented boundary. Do not write triggers before it is answered.
