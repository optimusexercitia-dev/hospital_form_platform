-- 412 — authz.scope_reaches: the commission -> organization ascent, after the AE4/IA-F9
-- plan fix. Subject: 20261003007310.
--
-- ⛔⛔ READ THIS BEFORE TRUSTING A GREEN HERE.
--
-- The migration replaces a two-table join with a single-column read:
--
--     before:  select h.organization_id from public.commissions c
--                join public.hospitals h on h.id = c.hospital_id where c.id = $2
--     after:   select c.organization_id from public.commissions c where c.id = $2
--
-- That is only sound because commissions_hospital_org_fkey — FOREIGN KEY (hospital_id,
-- organization_id) REFERENCES hospitals(id, organization_id) — forces the two columns to
-- agree. ⭐ THE FK IS THE SUBJECT OF THIS SUITE, not a precondition of it. §1 asserts the
-- three catalog facts the equivalence rests on, so that dropping any of them turns this
-- file RED rather than silently turning the shipped body into a wrong answer. A suite that
-- only asserted the new behaviour would stay green through exactly that change.
--
-- §2 is the differential: the RETIRED join form against the LIVE body, over every
-- commission in the database, on both polarities. §3 proves that differential can bite by
-- planting a wrong ascent and requiring it to go RED — a differential never shown able to
-- fail is indistinguishable from a dead one.
--
-- ⚠ WHY A FROZEN COPY OF THE JOIN FORM IS LEGITIMATE HERE. Same argument as 407: the join
-- body was DROPPED by 20261003007310 and can never change again, so it is a historical
-- baseline, not a second implementation of anything live. It is never compared to the live
-- BODY, only to the live ANSWER. §3's restore, by contrast, does NOT use a hand copy — it
-- captures pg_get_functiondef() from the catalog first and replays it, so the restore
-- cannot drift from what is actually installed.
--
-- ⚠ ARMS 4.5-4.8 ARE NEW COVERAGE, NOT REGRESSION COVER. Before this file, no pgTAP
-- assertion anywhere called authz.scope_reaches directly; the organization-from-hospital
-- and hospital-from-commission arms were asserted NOWHERE, in either polarity, and the
-- NULL-vs-FALSE behaviour of an absent id was asserted nowhere. Those arms are untouched
-- by 20261003007310 — they are pinned here because the fix put the function under review
-- and the gap was found, not because the fix endangered them.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()` — same reason as 401/407: its
-- subject is the real seeded tenancy population, which bootstrap's `truncate … cascade`
-- would destroy. It creates no permanent rows and the whole file rolls back.
--
-- ⚠ NO `set local role authenticated` ANYWHERE: application roles hold no USAGE on
-- `authz`, so the resolver is unreachable by them (401 §16). These run as the DEFINER's
-- own role, exactly as its callers reach it.
--
-- RUN SHAPE: `Files=2, Tests=25` (24 here + 00_setup.sql's one). ⛔ Keep this line in step
-- with plan() — a stale RUN SHAPE is read as the expected shape by the next person
-- diagnosing a count mismatch.

begin;
select plan(24);

-- ============================================================================
-- §0 — FIXTURE. Real seeded tenancy: one commission, its hospital, its organization,
-- and a genuinely FOREIGN organization/hospital from the other seeded network.
-- ============================================================================
create temp table f412 on commit drop as
  select c.id               as cid,
         c.hospital_id      as hid,
         c.organization_id  as oid
    from public.commissions c
   order by c.id
   limit 1;

create temp table f412x on commit drop as
  select (select o.id from public.organizations o
           where o.id <> (select oid from f412) order by o.id limit 1)   as foreign_oid,
         (select h.id from public.hospitals h
           where h.organization_id <> (select oid from f412)
           order by h.id limit 1)                                         as foreign_hid,
         (select c.id from public.commissions c
           where c.organization_id <> (select oid from f412)
           order by c.id limit 1)                                         as foreign_cid,
         '00000000-0000-4000-8000-0000000000ff'::uuid                     as absent_id;

-- The fixture must actually contain a second tenant, or every negative below is vacuous.
select ok(
  (select foreign_oid from f412x) is not null
  and (select foreign_hid from f412x) is not null
  and (select foreign_cid from f412x) is not null,
  '0.1 ⛔ FIXTURE CONTROL: the seed really does hold a SECOND organization with its own '
  'hospital and commission. Without it every "does not reach" assertion below would pass '
  'by having nothing to reject.');

-- ============================================================================
-- §1 — THE GROUND THE REWRITE STANDS ON. These are the keystone: the shipped body reads
-- commissions.organization_id INSTEAD of ascending to hospitals, and that is equivalent
-- only while all three of these hold.
-- ============================================================================
select ok(
  exists (
    select 1 from pg_constraint
     where conrelid  = 'public.commissions'::regclass
       and conname   = 'commissions_hospital_org_fkey'
       and contype   = 'f'
       and confrelid = 'public.hospitals'::regclass
       and pg_get_constraintdef(oid) =
           'FOREIGN KEY (hospital_id, organization_id) REFERENCES hospitals(id, organization_id)'
  ),
  '1.1 ⭐⭐ KEYSTONE: commissions_hospital_org_fkey is a COMPOSITE fk on (hospital_id, '
  'organization_id) -> hospitals(id, organization_id). This is what makes '
  'commissions.organization_id and the hospital ascent the same value. Drop it and '
  '20261003007310''s body becomes a guess.');

select is(
  (select count(*)::int from pg_attribute
    where attrelid = 'public.commissions'::regclass
      and attname in ('hospital_id', 'organization_id')
      and attnotnull),
  2,
  '1.2 ⭐ KEYSTONE: BOTH commissions.hospital_id and commissions.organization_id are NOT '
  'NULL. If either were nullable, MATCH SIMPLE would exempt the row from the fk and the '
  'two forms could diverge on exactly the rows nobody looks at.');

select ok(
  exists (
    select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
     where i.indrelid = 'public.hospitals'::regclass
       and c.relname  = 'hospitals_id_org_uq'
       and i.indisunique
  ),
  '1.3 KEYSTONE: hospitals_id_org_uq still exists — it is the unique index the composite '
  'fk in 1.1 is enforced against, so 1.1 cannot hold without it.');

-- ============================================================================
-- §2 — THE DIFFERENTIAL. The retired join form vs the live body, over EVERY commission,
-- both polarities. Frozen historical baseline; see the header for why that is legitimate.
-- ============================================================================
create function pg_temp.ae4_join_ascent(p_commission uuid)
returns uuid language sql stable as $frozen$
  select h.organization_id
    from public.commissions c
    join public.hospitals h on h.id = c.hospital_id
   where c.id = p_commission;
$frozen$;

-- Reusable: how many commissions does the live body answer differently from the join form?
create function pg_temp.ae4_disagreements()
returns bigint language sql stable as $diff$
  select count(*)
    from public.commissions c
   where authz.scope_reaches('commission', c.id, 'organization',
                             pg_temp.ae4_join_ascent(c.id)) is distinct from true
      or authz.scope_reaches('commission', c.id, 'organization',
                             (select foreign_oid from f412x)) is distinct from
         (pg_temp.ae4_join_ascent(c.id) = (select foreign_oid from f412x));
$diff$;

select cmp_ok((select count(*) from public.commissions), '>', 0::bigint,
  '2.0 ⛔ VACUITY CONTROL: there is at least one commission to run the differential over. '
  'An empty table would make 2.1 pass having compared nothing.');

select is(pg_temp.ae4_disagreements(), 0::bigint,
  '2.1 ⭐⭐ DIFFERENTIAL: over EVERY commission, the live authz.scope_reaches agrees with '
  'the retired commissions->hospitals join form — reaching its own organization, and NOT '
  'reaching the other tenant''s. Both polarities, no hand-picked row.');

-- ============================================================================
-- §3 — FAIL-PROOF. §2 is worthless unless it can go red. Plant a WRONG ascent (returns the
-- hospital id where the organization id belongs) and require the differential to catch it.
-- The restore replays the definition captured FROM THE CATALOG, not a copy written here.
-- ============================================================================
create temp table f412def on commit drop as
  select pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'authz' and p.proname = 'scope_reaches';

select is((select count(*)::int from f412def), 1,
  '3.0 the live authz.scope_reaches definition was captured for the restore — exactly one '
  'overload exists, so the restore in 3.3 cannot replay the wrong one.');

do $plant$
begin
  execute $ddl$
    create or replace function authz.scope_reaches(
      p_assignment_kind text, p_assignment_id uuid,
      p_resolution_kind text, p_requested_id uuid)
    returns boolean language sql stable security definer set search_path to ''
    as $planted$
      select case
        when p_assignment_kind = p_resolution_kind then p_assignment_id = p_requested_id
        when p_resolution_kind = 'organization' and p_assignment_kind = 'commission' then
          -- ae4plant412: the HOSPITAL id where the ORGANIZATION id belongs
          p_requested_id = (select c.hospital_id from public.commissions c where c.id = p_assignment_id)
        else false
      end;
    $planted$;
  $ddl$;
end
$plant$;

select ok(
  (select p.prosrc like '%ae4plant412%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'scope_reaches'),
  '3.1 ⛔ THE PLANT LANDED. A mutation that did not apply reports green, so the marker is '
  'asserted in the live body before anything is concluded from 3.2.');

select cmp_ok(pg_temp.ae4_disagreements(), '>', 0::bigint,
  '3.2 ⭐⭐ FAIL-PROOF: with a WRONG ascent installed, §2''s differential goes RED. The '
  'green at 2.1 is therefore a measurement and not a dead instrument.');

do $restore$
begin
  execute (select def from f412def);
end
$restore$;

select is(pg_temp.ae4_disagreements(), 0::bigint,
  '3.3 ⛔ THE RESTORE IS PROVEN, not assumed: the shipped body is back and the differential '
  'is zero again. A harness that cannot show its rollback landed has measured nothing.');

-- ============================================================================
-- §4 — THE FOUR ARMS, CALLED DIRECTLY. 4.5-4.8 are coverage that existed nowhere before
-- this file (see the header).
-- ============================================================================
select ok(authz.scope_reaches('commission', (select cid from f412), 'commission', (select cid from f412)),
  '4.1 ARM same-kind, positive: a commission reaches itself.');

select ok(not authz.scope_reaches('commission', (select cid from f412), 'commission', (select foreign_cid from f412x)),
  '4.2 ARM same-kind, negative: a commission does not reach a different commission.');

select ok(authz.scope_reaches('commission', (select cid from f412), 'organization', (select oid from f412)),
  '4.3 ⭐ ARM organization<-commission, positive: THE ASCENT 20261003007310 REWROTE. The '
  'commission reaches its own organization.');

select ok(not authz.scope_reaches('commission', (select cid from f412), 'organization', (select foreign_oid from f412x)),
  '4.4 ⭐⭐ ARM organization<-commission, negative: the ascent ASCENDS, it does not CROSS '
  'TENANTS. This is the assertion that a wrong rewrite would break.');

select ok(authz.scope_reaches('hospital', (select hid from f412), 'organization',
                              (select h.organization_id from public.hospitals h where h.id = (select hid from f412))),
  '4.5 ⭐ ARM organization<-hospital, positive — asserted NOWHERE before this file.');

select ok(not authz.scope_reaches('hospital', (select hid from f412), 'organization', (select foreign_oid from f412x)),
  '4.6 ⭐ ARM organization<-hospital, negative — asserted NOWHERE before this file.');

select ok(authz.scope_reaches('commission', (select cid from f412), 'hospital', (select hid from f412)),
  '4.7 ⭐ ARM hospital<-commission, positive — asserted NOWHERE before this file.');

select ok(not authz.scope_reaches('commission', (select cid from f412), 'hospital', (select foreign_hid from f412x)),
  '4.8 ⭐ ARM hospital<-commission, negative — asserted NOWHERE before this file.');

select ok(not authz.scope_reaches('organization', (select oid from f412), 'commission', (select cid from f412)),
  '4.9 ARM else: the ascent is ONE-DIRECTIONAL. An organization-scoped assignment does not '
  'descend to a commission — no arm matches, so the else branch denies.');

-- ============================================================================
-- §5 — NULL-vs-FALSE, PINNED. 20261003007310 deliberately kept the scalar-subquery shape
-- rather than rewriting to `exists`, which would have returned FALSE here. Both callers
-- (authz.entailed_grants, authz.explain_permission) use the result inside a WHERE, where
-- NULL and FALSE are indistinguishable — so this difference is invisible today and would
-- become visible the moment a caller used it in a boolean expression instead.
-- ============================================================================
select ok(authz.scope_reaches('commission', (select absent_id from f412x), 'organization', (select oid from f412)) is null,
  '5.1 ⭐ organization<-commission with an ABSENT commission yields NULL, not FALSE — the '
  'scalar-subquery semantics the rewrite preserved on purpose.');

select ok(authz.scope_reaches('commission', (select absent_id from f412x), 'hospital', (select hid from f412)) is null,
  '5.2 hospital<-commission with an ABSENT commission yields NULL, not FALSE.');

select ok(authz.scope_reaches('hospital', (select absent_id from f412x), 'organization', (select oid from f412)) is null,
  '5.3 organization<-hospital with an ABSENT hospital yields NULL, not FALSE.');

-- ============================================================================
-- §6 — THE PLAN DEFECT ITSELF. §2 proves the ANSWER is unchanged; it cannot see that the
-- join came back, because the join form returns the same answer. These two read the live
-- catalog body — the authoritative source for what is installed, never a migration file.
-- ============================================================================
select ok(
  (select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'scope_reaches')
  not like '%join public.hospitals%',
  '6.1 ⭐⭐ THE REGRESSION PIN: the body contains NO join to public.hospitals. That join was '
  'the InitPlan Hash Join which seq-scanned and hashed all of hospitals on every call '
  '(AE4 acceptance §10.3). §2 cannot catch its return — the join gives the same ANSWER — '
  'so the plan shape is asserted here or nowhere.');

select ok(
  (select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'scope_reaches')
  like '%public.hospitals%',
  '6.2 ⛔ COUNTER-PIN, so 6.1 cannot be satisfied by deleting too much: public.hospitals is '
  'STILL read — the organization<-hospital arm needs it and was deliberately left alone. '
  '6.1 without this would also pass on a body that lost that arm entirely.');

select * from finish();
rollback;
