-- AE1.1 (audit finding F7; ADR 0155 D9) — `commission_administrativos` gains FKs on
-- its two IDENTIFYING columns. Preflight, derivation, and cascade-closure check are
-- recorded in full in docs/design/authz-ae1-fk-preflight.md — this migration is
-- written straight from that approved contract; do not re-derive here.
--
-- THE DEFECT (F7): the table carried exactly one FK — `appointed_by -> profiles(id)`.
-- `commission_id` and `user_id` had NO FK at all, so an appointment row could point
-- at a commission or a person that no longer exists.
--
-- ORPHAN PREFLIGHT (both stacks, positive-controlled — see the design doc §2):
-- 0 orphaned `commission_id`, 0 orphaned `user_id`, over the one row both stacks
-- hold. Low power, stated: this is enough for VALIDATE to succeed, not evidence
-- about behaviour under real data.
--
-- ON DELETE — DERIVED, not guessed, from the sibling appointment table
-- `public.memberships` (design doc §3): the SUBJECT and the SCOPE cascade there
-- (`memberships_principal_id_fkey`, `memberships_commission_id_fkey` — both
-- CASCADE); the ACTOR restricts (`memberships_granted_by_fkey` — no ON DELETE).
-- `commission_administrativos.appointed_by` is the actor column and already
-- carries no ON DELETE, matching the sibling exactly. `commission_id` (scope) and
-- `user_id` (subject) therefore both get CASCADE.
--
-- CASCADE CLOSURE (design doc §4) — these FKs do not newly enable deleting a
-- commission or a profile: a commission delete is already reachable today under
-- `commissions_admin_write` with no FK (today it silently ORPHANS, which is F7
-- itself); a profile delete is already blocked by `guard_profile_no_delete_trg`
-- regardless. The FK changes the delete's EFFECT (orphans -> cascade-cleaned),
-- never its reachability — strictly the fix. Rule 11 holds through the cascade:
-- `trg_audit_administrativo` is a ROW-level AFTER INSERT/DELETE trigger
-- (tgtype = 13), and Postgres fires row-level triggers per cascaded row, so each
-- cascade-deleted appointment still emits its audit event (unlike TRUNCATE, which
-- fires no DELETE trigger at all and is not used here or anywhere near this path).
--
-- Production-safe sequence, per the design doc §5: ADD ... NOT VALID first (weak
-- lock, no table scan), then a separate VALIDATE CONSTRAINT (scans without
-- blocking writers). No top-level SET LOCAL is used (none is needed).

alter table public.commission_administrativos
  add constraint commission_administrativos_commission_id_fkey
  foreign key (commission_id) references public.commissions(id) on delete cascade
  not valid;

alter table public.commission_administrativos
  validate constraint commission_administrativos_commission_id_fkey;

comment on constraint commission_administrativos_commission_id_fkey
  on public.commission_administrativos is
  'AE1.1/F7 -- the SCOPE column of the appointment row. ON DELETE CASCADE derived from memberships_commission_id_fkey (the sibling appointment table''s scope columns all cascade). See docs/design/authz-ae1-fk-preflight.md section 3.';

alter table public.commission_administrativos
  add constraint commission_administrativos_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade
  not valid;

alter table public.commission_administrativos
  validate constraint commission_administrativos_user_id_fkey;

comment on constraint commission_administrativos_user_id_fkey
  on public.commission_administrativos is
  'AE1.1/F7 -- the SUBJECT column of the appointment row. ON DELETE CASCADE derived from memberships_principal_id_fkey (the sibling appointment table''s subject column cascades). Effectively unreachable through ordinary deletion today (profiles are delete-guarded by guard_profile_no_delete_trg) -- added for correctness, matching the sibling shape. See docs/design/authz-ae1-fk-preflight.md section 3.';
