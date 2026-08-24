-- ============================================================================
-- ADR 0137 D4 — Migration D: a referral cannot be SENT without an MRN.
--
-- ⛔ `public.send_referral` IS RE-EMITTED FROM `pg_get_functiondef()` ON THE LIVE
--    CATALOG, never from migration text. Bodies in this repo are rewritten at
--    runtime by earlier migrations, so a file is stale by design (ADR 0078
--    "METHODOLOGY FINDING").
--
-- WHY AT SEND AND NOT AT SAVE (ADR 0137 D4, quoted because a future reader will
-- reach for the symmetry): the rationale is NOT parity with the case module —
-- it is that **a referral without a patient key is undeliverable work**. The
-- receiving committee has nothing to look up, and a communication that needs no
-- patient is a message, not an encaminhamento. A half-entered DRAFT must still
-- save, so the floor moves at the transition, not at the write.
--
-- ⛔ THREE THINGS THIS MIGRATION DELIBERATELY DOES NOT TOUCH:
--
--  1. **The safety module keeps `name OR mrn`, unchanged.** ADR 0137
--     Consequences is explicit and the reason is clinical, not clerical: an NSP
--     notification is often filed at the bedside by someone holding a name and
--     no chart, and blocking that notification is a PATIENT-SAFETY cost, not a
--     compliance win. The ADR names this as "the most likely thing a future
--     reader will 'fix'". Do not.
--
--  2. **The referral draft-save floor.** ⚠ MEASURED, AND NOT WHERE THE PLAN SAYS
--     IT IS: `public.save_referral_patient` contains no floor at all — it is a
--     pure delegation to `public.set_referral_patient`, which ALSO has none. The
--     comment-stripped catalog sweep for the floor's message string returns
--     exactly ONE body, `app._set_participant_patient_unchecked`, which belongs
--     to the CASE module. The referral floor is therefore enforced ONLY in the
--     action layer (`src/lib/referrals/actions.ts`), and D4's "the existing
--     `name OR mrn` floor on `save_referral_patient` is not tightened" is
--     satisfied by leaving both bodies alone — there is nothing here to loosen
--     or tighten. Stated rather than assumed, because "the floor is unchanged"
--     would otherwise be a claim about a thing that does not exist.
--
--  3. **A table-level backstop.** Inc 0 needed a deferred constraint trigger on
--     `cases` because `authenticated` holds full DML there, `cases_staff_admin_write`
--     is a FOR ALL policy, and `app.guard_case_status` has no INSERT arm — so a
--     direct-table INSERT walked past every RPC check. ⭐ THE REFERRAL SHAPE IS
--     DIFFERENT, and the difference is measured, not assumed:
--     `app.guard_referral_status` refuses ANY `status` change made outside
--     `app.in_referral_rpc` (`HC070`), so the `draft -> sent` transition this
--     guard protects is structurally reachable only through an RPC. The gate
--     therefore belongs in the door and nowhere else. That closure is asserted
--     in supabase/tests/363 rather than trusted to this comment.
--
-- SQLSTATE: `HC0T4`. ADR 0135 — an authored refusal gets its own code so a
-- mapper may surface it unconditionally and `throws_ok(..., 'HC0T4')` can only
-- pass on the refusal this door wrote.
-- ⛔ NOT `check_violation`. The description/item guard immediately above the new
--    block raises exactly that, and copying it would make the two refusals
--    indistinguishable to both the mapper and the test — which is the precise
--    ambiguity ADR 0135 exists to end.
--
-- ⛔ NO TOP-LEVEL `set local` (silent 25P01 no-op). This file needs none.
-- ============================================================================

create or replace function public.send_referral(p_referral_id uuid)
 returns case_referral_public
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_referral public.case_referral;
  v_item_count integer;
  v_mrn text;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode enviar o encaminhamento'
      using errcode = 'HC071';
  end if;
  if v_referral.status <> 'draft' then
    raise exception 'apenas rascunhos podem ser enviados' using errcode = 'HC070';
  end if;

  select count(*) into v_item_count from public.referral_shared_item where referral_id = p_referral_id;
  if v_item_count = 0 and btrim(coalesce(v_referral.description_md, '')) = '' then
    raise exception 'Informe uma descrição, ou anexe ao menos uma narrativa ou documento, antes de enviar.'
      using errcode = 'check_violation';
  end if;

  -- ADR 0137 D4 — THE MRN IS THE LGPD ERASURE KEY, and this is the point at
  -- which the platform commits to being able to find these rows again.
  -- Placed with the other CONTENT checks (after authority and state, before the
  -- transition) so a caller learns everything that is wrong with the draft's
  -- content in the same phase of the door.
  --
  -- One query covers BOTH failing shapes — no `referral_patient` row at all, and
  -- a row whose `mrn` is null or whitespace. A test that only builds the second
  -- would leave the first, which is the far more common one, unguarded.
  --
  -- ⚠ A `none`-mode SOURCE CASE DOES NOT EXEMPT THE REFERRAL (D4, deliberate and
  -- accepted): case PHI and referral PHI are independently isolated
  -- (`patient_identifiers` vs `referral_patient`), so the coordinator enters the
  -- MRN by hand. This is a real friction that was ruled on, not an oversight to
  -- be optimized away by reading through to the case.
  select rp.mrn into v_mrn
  from public.referral_patient rp where rp.referral_id = p_referral_id;
  if coalesce(btrim(v_mrn), '') = '' then
    raise exception
      'Informe o prontuário do paciente antes de enviar o encaminhamento.'
      using errcode = 'HC0T4';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'sent', sent_at = now(), sent_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);

  return app._project_case_referral(v_row);
end;
$function$;

comment on function public.send_referral(uuid) is
  'ADR 0137 D4. Sends a draft referral. Refuses with HC0T4 when the referral '
  'carries no referral_patient MRN — the MRN is the LGPD erasure key and a '
  'referral without a patient key is undeliverable work. The draft-SAVE floor is '
  'unchanged (a partially-entered draft still saves).';

-- ── Post-condition: the door is still exactly one, and still the only one ────
--
-- ⚠ `create or replace` on a function whose RETURNS type is a composite would
--   fail loudly on a shape change, so the return type needs no separate pin.
--   What DOES need pinning is that this migration did not accidentally mint a
--   second overload (which PostgREST would 300 on) and that the ACL survived —
--   `create or replace` preserves `proacl`, but "preserves" is a claim worth one
--   cheap assertion at the point of change rather than a belief.
do $verify$
declare
  v_n integer;
begin
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'send_referral';
  if v_n <> 1 then
    raise exception 'send_referral has % overloads; expected exactly 1', v_n
      using errcode = 'HC0T5';
  end if;

  if not has_function_privilege('authenticated', 'public.send_referral(uuid)', 'EXECUTE') then
    raise exception 'send_referral lost its authenticated EXECUTE grant'
      using errcode = 'HC0T5';
  end if;
  if has_function_privilege('anon', 'public.send_referral(uuid)', 'EXECUTE') then
    raise exception 'send_referral is executable by anon' using errcode = 'HC0T5';
  end if;

  -- The new refusal must actually be in the live body. A `create or replace`
  -- that silently no-op'd (wrong signature, wrong schema) would leave the old
  -- body in place and every downstream test would then be measuring the door
  -- this migration meant to replace.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'send_referral'
         and regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
             ~ '\mHC0T4\M') <> 1 then
    raise exception 'send_referral does not carry the HC0T4 refusal after re-emission'
      using errcode = 'HC0T5';
  end if;
end;
$verify$;
