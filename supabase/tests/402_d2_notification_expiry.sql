-- 402 — D2: the seat-expiry term in four NOTIFICATION-TARGETING bodies.
-- Subject: 20261003007180. Matrix § 1.2 (finding) · § 10 D2 (disposition (a)).
--
-- ⛔ THIS IS A NARROWING, SO IT FAILS CLOSED — the inverse risk profile to Increment 1's
-- widening. The failure mode here is OVER-narrowing: a term that also excludes LIVE seats,
-- silently stopping notifications that should arrive. So every body gets BOTH polarities, and
-- the LIVE-SEAT arm is the one that matters most — a fix that denied everyone would satisfy
-- the lapsed-seat arm perfectly.
--
-- ⚠ § 1's catalog-positive assertions are the DURABLE half: a future `create or replace` that
-- silently drops the term reds there, and no diff review would catch that.
--
--
-- ============================================================================
-- ⛔ WHY THIS SUITE IS D2'S PRIMARY EVIDENCE: THE DOOR SWEEP CANNOT MEASURE THESE FOUR.
-- Both arms returned exit 3 (UNPROVEN — "nothing was measured: no case selected"), even
-- with an EXPLICIT case list. That is UNPROVEN, not green, and it is not recorded as a pass.
--
-- TWO INDEPENDENT BLINDNESSES, both measured:
--
--   1. THE DERIVER cannot see the migration. `scripts/door-sweep-cases.sh` selects on the
--      diff TEXT — `/create[ 	]+(or[ 	]+replace[ 	]+)?function[ 	]+(app|public)\./`.
--      20261003007180 contains ZERO matches for that or for `create policy` / `alter policy`
--      / `security definer`, because it uses the house `pg_get_functiondef` + `replace` +
--      `execute` pattern. ⭐ A text-based deriver is blind, BY CONSTRUCTION, to exactly the
--      pattern CLAUDE.md documents as making migration text stale — and any future gate keyed
--      on migration text inherits the same blindness.
--
--   2. THE HARNESSES cannot see the FUNCTIONS, and this one is more fundamental — even a
--      perfect deriver would have selected zero. `PRED_DOMAIN` requires `t.typname='bool'`.
--      Measured return types: int4, int4, int4, `responses`. None is a boolean gate, none is
--      referenced by any policy, so the neutralization model ("swap the gate body for
--      `select true`") has NO GATE TO SWAP: the authorization decision is a WHERE-clause term
--      inside a larger query, not a separable predicate.
--
-- ⭐ That second shape is exactly the one authz-evolution plan rule 4 names — the authority
-- decision belongs in "a `bool`, `can_`-named `app` predicate census/policy do contain".
-- These four embed it inline, so no arm can reach them, and rule 4 says that shape obliges a
-- DIFFERENT DISCHARGE. This suite is that discharge: it measures the RESOLVED SET
-- behaviourally (who actually gets notified), which for this shape is stronger evidence than
-- neutralizing a gate that does not exist.
--
-- ⚠ BOUND, STATED SO IT IS NOT OVERCLAIMED: "unswept by the diff-scoped sweep" is NOT
-- "unprotected". Whether the periodic full sweep holds verdicts for these is a SEPARATE
-- question, to be measured and not assumed.
-- ============================================================================
-- RUN SHAPE: `Files=2, Tests=14` (13 here + 00_setup.sql's one).

begin;
select plan(13);

-- ============================================================================
-- §1 — CATALOG-POSITIVE: the term is present in all four bodies.
-- ============================================================================

select ok(
  (select p.prosrc ~ 'expires_at is null or expires_at > now'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'compute_due_charter_notifications'),
  '1.1 app.compute_due_charter_notifications carries the expiry term');

select ok(
  (select p.prosrc ~ 'expires_at is null or expires_at > now'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'compute_due_document_review_notifications'),
  '1.2 app.compute_due_document_review_notifications carries it');

select ok(
  (select p.prosrc ~ 'expires_at is null or expires_at > now'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'compute_due_notifications'),
  '1.3 public.compute_due_notifications carries it');

select ok(
  (select p.prosrc ~ 'expires_at is null or expires_at > now'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_section_answers'),
  '1.4 public.save_section_answers carries it. ⚠ This one is INVOKER (prosecdef = f), unlike '
  'the other three — the fix is identical because the defect was in the QUERY, not in the '
  'privilege model.');

-- ============================================================================
-- §2 — the fixture, and its control.
-- ============================================================================

create temp table t402 on commit drop as
  select c.id as response_id, c.commission_id,
         (select m.principal_id from public.memberships m
           where m.commission_id = c.commission_id and m.role = 'staff_admin' limit 1) as sa,
         (select ps.section_id from app.pending_staff_signoffs(c.id) ps limit 1) as section_id
    from public.responses c
   where (c.status = 'in_progress' or app.is_signoff_deferral_open(c.id))
     and (c.status = 'submitted' or app.response_required_complete(c.id))
     and exists (select 1 from app.pending_staff_signoffs(c.id))
   limit 1;

select is(
  (select count(*)::int from t402
    where response_id is not null and sa is not null and section_id is not null),
  1,
  '2.1 FIXTURE CONTROL: one qualifying response, with a staff_admin and a pending signoff '
  'section. A zero here would make every behavioural arm below assert over nothing.');

-- ============================================================================
-- §3 — app.compute_due_charter_notifications, both polarities.
-- ============================================================================

delete from public.notifications;
select cmp_ok(app.compute_due_charter_notifications(), '>', 0,
  '3.1 ⭐ LIVE SEAT still notified — the OVER-NARROWING guard. A term that also excluded live '
  'seats would pass 3.2 perfectly and fail here, and that is the characteristic failure of a '
  'narrowing.');

delete from public.notifications;
update public.memberships set expires_at = now() - interval '1 day' where role = 'staff_admin';
select is(app.compute_due_charter_notifications(), 0,
  '3.2 LAPSED SEAT no longer notified — the fix itself');
update public.memberships set expires_at = null where role = 'staff_admin';

-- ============================================================================
-- §4 — app.compute_due_document_review_notifications, both polarities.
-- ============================================================================

delete from public.notifications;
select cmp_ok(app.compute_due_document_review_notifications(), '>', 0,
  '4.1 LIVE SEAT still notified');

delete from public.notifications;
update public.memberships set expires_at = now() - interval '1 day' where role = 'staff_admin';
select is(app.compute_due_document_review_notifications(), 0,
  '4.2 LAPSED SEAT no longer notified. ⛔ Reachable consequence of the defect this fixes: the '
  'body carried the controlled document CODE + TITLE, so a lapsed coordinator kept receiving '
  'governance CONTENT, not a bare ping.');
update public.memberships set expires_at = null where role = 'staff_admin';

-- ============================================================================
-- §5 — public.save_section_answers, both polarities.
-- Its notification arm fires when the response is complete and a staff signoff is pending.
-- ============================================================================

delete from public.notifications;
select public.save_section_answers(
  (select response_id from t402), (select section_id from t402),
  '{}'::jsonb, array[]::uuid[], '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);
select ok(
  exists (select 1 from public.notifications n
           where n.user_id = (select sa from t402)
             and n.entity_type = 'response_section_signoff'
             and n.milestone = 'requested'),
  '5.1 LIVE SEAT still notified on save');

delete from public.notifications;
update public.memberships set expires_at = now() - interval '1 day' where role = 'staff_admin';
select public.save_section_answers(
  (select response_id from t402), (select section_id from t402),
  '{}'::jsonb, array[]::uuid[], '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);
select ok(
  not exists (select 1 from public.notifications n
               where n.user_id = (select sa from t402)
                 and n.entity_type = 'response_section_signoff'),
  '5.2 LAPSED SEAT no longer notified on save');
update public.memberships set expires_at = null where role = 'staff_admin';

-- ============================================================================
-- §6 — public.compute_due_notifications (its staff_admin signoff arm), both polarities.
-- ⭐ Its precondition is a `requested` notification at least 3 days old — which is exactly
-- what § 5 produces. The two bodies chain here the way they do in production.
-- ============================================================================

delete from public.notifications;
select public.save_section_answers(
  (select response_id from t402), (select section_id from t402),
  '{}'::jsonb, array[]::uuid[], '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);
update public.notifications set created_at = now() - interval '4 days'
 where entity_type = 'response_section_signoff' and milestone = 'requested';

select public.compute_due_notifications();
select ok(
  exists (select 1 from public.notifications n
           where n.user_id = (select sa from t402) and n.kind = 'signoff'
             and n.milestone in ('pending', 'still_open')),
  '6.1 LIVE SEAT still notified by the overdue-signoff arm');

delete from public.notifications where milestone in ('pending', 'still_open');
update public.memberships set expires_at = now() - interval '1 day' where role = 'staff_admin';
select public.compute_due_notifications();
select ok(
  not exists (select 1 from public.notifications n
               where n.user_id = (select sa from t402) and n.kind = 'signoff'
                 and n.milestone in ('pending', 'still_open')),
  '6.2 LAPSED SEAT no longer notified. ⚠ The `requested` prerequisite is left in place, so '
  'this arm is denied by the SEAT term and not by its precondition vanishing — without that, '
  '6.2 would pass for the wrong reason.');
update public.memberships set expires_at = null where role = 'staff_admin';

select * from finish();
rollback;
