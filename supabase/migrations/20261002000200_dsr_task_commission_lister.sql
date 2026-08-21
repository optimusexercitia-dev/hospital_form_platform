-- =============================================================================
-- DSR Slice 3, fix — BUG-DSR-S3-002: name the commission an attestation covers.
--
-- ⛔ THE DEFECT IS NOT COSMETIC. The attested tier's entire value is that a NAMED
-- HUMAN states, on the record, that they reviewed a DEFINED SCOPE — and that
-- statement, plus its redaction count, is what the outcome record reports to the
-- data subject. `listMyDsrTasks` read the commission name through a PostgREST
-- embed on `commissions`, which is RLS-filtered; the Encarregado is a plain member
-- of exactly ONE commission BY DESIGN (ADR 0130 Decision 2's split-powers
-- premise), so a sibling commission's name came back NULL and the card rendered
-- "Comissão fora do seu acesso" directly above procedure text reading "Revise o
-- conteúdo em texto livre DESTA COMISSÃO".
--
-- An attestation against a scope the attester cannot see is not a weaker
-- attestation. It is a NOMINAL one — and the outcome record would then count it as
-- coverage. That is the two-tier claim going hollow at the exact point it exists
-- to be honest.
--
-- MEASURED, not inferred (local catalog, 2026-08-20): as the seeded Encarregado,
-- `select slug from public.commissions` returns exactly `ccih`; the fan-out's two
-- per-commission attestations resolve to `Comissão de Controle de Infecção
-- Hospitalar` and **NULL** respectively. `commissions_select_member_or_admin`
-- requires `app.is_member_of(id)` OR one of five admin arms, and the Encarregado
-- holds none of them for a sibling commission.
--
-- ---------------------------------------------------------------------------
-- ⛔ WHY A LISTER AND NOT A POLICY ARM — the SAME choice, one grain down.
--
-- ADR 0130 Amendment 2 item 5 faced this at the HOSPITAL grain: `hospitals_select`
-- admits five admin roles and not the Encarregado, so they could not read the name
-- of the hospital they serve. Adding `or app.is_dpo_of(id)` to a shared directory
-- table was rejected as a SECOND widening in a program whose ADR names exactly one
-- (Decision 3, the PHI search door), and `list_my_dsr_hospitals` was built instead
-- — the pattern this codebase already uses for exactly this need
-- (`list_my_nsp_hospitals`, ADR 0052).
--
-- Identical reasoning here, so: identical shape. **`commissions`' read boundary
-- does not move.** A DSR task the caller can already see is allowed to tell them
-- WHICH commission it names — nothing more.
--
-- ⚠ IT GRANTS NO AUTHORIZATION AND CAN LEAK NOTHING NEW. Its predicate is
-- `dsr_tasks_select`'s USING expression, calling the SAME two predicates
-- (`app.is_dpo_of`, `app.can_execute_dsr_task`) that the policy calls, over the
-- rows that policy already returns. A commission the caller holds no task in is
-- not reachable through it, and the name of a commission is already visible to
-- them on the task itself in every case where the embed works.
--
-- ⭐ AND THE MIRROR IS ASSERTED, NOT PROMISED. "The lister calls the same
-- predicates the policy calls" is a claim about text, and text goes stale
-- silently — a policy could gain an arm this expression never learns about. So
-- `350` t59 pins the DIFFERENTIAL instead: for each persona, the lister's
-- commission set must EQUAL the set derived from the tasks `dsr_tasks_select`
-- actually returns. Drift between the copy and the policy goes red.
-- =============================================================================

create or replace function public.list_my_dsr_task_commissions(p_hospital_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(
           jsonb_agg(distinct jsonb_build_object(
             'commissionId', c.id,
             'name', c.name,
             'slug', c.slug
           )),
           '[]'::jsonb)
  from public.dsr_tasks t
  join public.commissions c on c.id = t.commission_id
  where app.feature_enabled('dsr')
    and t.hospital_id = p_hospital_id
    -- ⚠ VERBATIM `dsr_tasks_select`. Not a widening of it, not a simplification
    -- of it: the same two predicate calls in the same boolean shape, so this door
    -- returns a commission id ONLY where the policy already returns a task
    -- carrying it. 350 t59 asserts the two sets are equal rather than trusting
    -- this comment.
    and (app.is_dpo_of(t.hospital_id)
         or app.can_execute_dsr_task(t.hospital_id, t.commission_id, (select auth.uid())));
$$;

-- ⚠ A NULL `proacl` is the DEFAULT and it INCLUDES PUBLIC — the
-- guards-that-fail-open family. Explicit for this NEW function.
-- ⛔ And nothing above is a `create or replace` of a PRE-EXISTING object, so no
-- other ACL is touched by this migration. That distinction is load-bearing: this
-- slice already widened `app.patient_trajectory_bundle` by applying this very
-- idiom to a REWRITE (suite 152 §M1 caught it). `CREATE OR REPLACE FUNCTION` does
-- not reset an ACL; the grant line belongs to newly-created functions only.
revoke all on function public.list_my_dsr_task_commissions(uuid) from public, anon;
grant execute on function public.list_my_dsr_task_commissions(uuid) to authenticated, service_role;
