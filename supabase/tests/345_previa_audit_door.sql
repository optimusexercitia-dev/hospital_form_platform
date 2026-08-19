-- =============================================================================
-- `public.log_document_previa` — the ephemeral prévia's audit door.
-- ADR 0125 D3 (audited, no bytes, no registry row) + D6 (authority is source-read).
--
-- ⭐ THIS IS D6'S BEHAVIOURAL KEYSTONE, and it exists because of what it CANNOT
-- be. ADR 0125 D6 notes that the prévia's real protection is inherited RLS — the
-- providers read the source under the caller's session, so a caller who cannot
-- read it cannot build a payload. That protection is genuine but TRANSITIVE: an
-- app-layer route with no `prosecdef` gate is in **no ADR 0079 arm's domain**
-- (the Amendment 7 shape), so nothing would go red if a future edit swapped one
-- of those queries to the admin client.
--
-- So D6 requires a BEHAVIOURAL keystone rather than an arm: *a principal who
-- cannot read the source is refused a prévia.* That is what t6/t7 pin, against
-- the door that now carries the gate.
--
-- ⛔ THE DIFFERENTIAL IS THE POINT (t4/t5 vs t6/t7). Without the ALLOW leg, the
-- deny leg is equally satisfied by a door that refuses EVERYONE — which would
-- also "pass" while silently removing the prévia from the product. Without the
-- DENY leg, the allow leg is satisfied by a door with no gate at all. The
-- probe principal is `st_x2`: a same-commission PLAIN STAFF member — a
-- reader-non-creator, not a foreign one — so the refusal exercises the source
-- visibility rule and not a tenancy wall (authz-handoff §7).
--
-- ⛔⛔ THE PROBES PASS THE SOURCE ID AS A LITERAL, NEVER `(select … from r)` —
-- AND THAT IS A CORRECTNESS REQUIREMENT, NOT A STYLE CHOICE. Measured the hard
-- way while writing this file: the temp fixture tables initially had no
-- `grant select … to authenticated`, so a probe reading `r` under the
-- `authenticated` role raised **42501 — permission denied for table r**.
--
-- t8 asserts `throws_ok(…, '42501')`. It therefore PASSED — on the fixture's own
-- permission error, with the door's authority check never reached. Only the ALLOW
-- leg failing exposed it; a deny-only keystone would have been GREEN while
-- asserting nothing about authorization at all.
--
-- Both fixes are kept deliberately: the grants (so the allow leg works) AND the
-- literal in the probe (so no temp-table read happens inside the probe, and the
-- only thing that can raise 42501 is the door). This is `312` t73's lesson in a
-- new place — *"a green test with a plausible-but-wrong refusal is the failure
-- mode this file guards"* — and 42501 is especially treacherous because it is
-- simultaneously the correct authorization SQLSTATE and Postgres's generic
-- permission-denied code.
-- =============================================================================

begin;
select plan(9);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
create temp table k on commit drop as
  select (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

create temp table r on commit drop as
  select '00000000-0000-0000-0000-0000000005a1'::uuid as resp_sub;
grant select on r to authenticated;
-- ⚠ IN_PROGRESS, not submitted. A prévia is for a source that does NOT register;
-- once B1 made log_document_previa refuse a locked source (HC0DV), a submitted
-- response became the WRONG fixture — it registers, so it must be EMITTED. This
-- file is about the AUDIT + AUTHORITY of the ephemeral path, so its source has to
-- be one the ephemeral path legitimately serves.
insert into public.responses
  (id, form_version_id, commission_id, created_by, status, started_at)
select r.resp_sub, k.ver_u, k.comm_x, k.st_x, 'in_progress', now() from r, k;

-- ── 0. Preconditions, ASSERTED not assumed (authz-handoff §7.3) ─────────────
select is(app.feature_enabled('document_printing'), true,
  't1 PRECONDITION: document_printing is ON — otherwise every call below fails on '
  'the flag and the authority assertions would pass for the wrong reason');
select is(app.feature_enabled('audit_trail'), true,
  't2 PRECONDITION: audit_trail is ON — the audit-row counts below can observe writes');

-- ── 1. The discriminating property is real, BEFORE relying on it ────────────
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select st_x from k)), true,
  't3 the creator CAN view his own in_progress draft (the allow leg''s premise)');
select is(app.can_view_printed_document('form_response', (select resp_sub from r), (select st_x2 from k)), false,
  't4 ⭐ CONTROL: same-commission PLAIN STAFF (non-creator) CANNOT view it. If this '
  'were true the deny leg below would be vacuous — refusing nobody');

-- ── 2. ALLOW leg: the entitled caller gets a prévia, and it is LOGGED ───────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.log_document_previa('form_response', '00000000-0000-0000-0000-0000000005a1'::uuid, 'form_response')$$,
  't5 ALLOW: a caller who can read the source logs a prévia (no registry row, no bytes)');
reset role;

select is(
  (select count(*)::int from public.audit_log
    where action = 'document.previa_printed'
      and entity_id = (select resp_sub from r)),
  1,
  't6 ⭐ ADR 0125 D3: EXACTLY ONE audit row — the half that cannot be added '
  'retroactively. Unstored bytes can be re-rendered from the source; an unlogged '
  'event is gone');

-- ⛔ Rule 11 shape: the row records THAT + WHO, never the payload. A prévia of a
-- PHI-bearing ata must log that it was printed, not what it said.
select is(
  (select (metadata ? 'template_key') and not (metadata ? 'minutes_md')
          and not (metadata ? 'answers') and entity_type = 'form_response'
     from public.audit_log
    where action = 'document.previa_printed'
      and entity_id = (select resp_sub from r)),
  true,
  't7 Rule 11: the row carries the template LABEL and the source kind as its '
  'entity_type — never source content, and never a dangling `printed_document` '
  'reference for a registry row that by construction does not exist');

-- ── 3. DENY leg: D6's behavioural keystone ─────────────────────────────────
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$select public.log_document_previa('form_response', '00000000-0000-0000-0000-0000000005a1'::uuid, 'form_response')$$,
  '42501', null,
  't8 ⭐⭐ D6 BEHAVIOURAL KEYSTONE: a principal who cannot read the source is '
  'REFUSED a prévia. The route''s inherited-RLS protection is transitive and in no '
  'authz ARM''s domain; this door makes the refusal one a test can see');
reset role;

select is(
  (select count(*)::int from public.audit_log
    where action = 'document.previa_printed'
      and entity_id = (select resp_sub from r)),
  1,
  't9 ⭐ THE REFUSAL LOGGED NOTHING: still exactly one row, not two. A denial that '
  'wrote an audit row would let an unauthorized caller append to an append-only '
  'trail — and would make t6''s count pass for the wrong reason');

select * from finish();
rollback;
