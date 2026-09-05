-- A DEFINER door the arm's PRED_DOMAIN admits by its NAMED EXCEPTION, not by return type.
-- Catalog: app.assert_not_case_excluded -> void, prosecdef=t, IN domain.
-- ⭐ The old deriver demanded `returns boolean` from the migration TEXT and dropped it.
create or replace function app.assert_not_case_excluded(p_case_id uuid)
returns void
language plpgsql
security definer
as $$ begin perform 1; end; $$;
