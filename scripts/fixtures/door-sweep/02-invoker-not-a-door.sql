-- Catalog: public.save_section_answers -> prosecdef=f. An INVOKER is not a door for either
-- door arm; it belongs to p0-authz-invoker-audit.sh. ⛔ The migration text SAYS
-- `security definer` and the deriver must ignore that: text is not truth, the catalog is.
create or replace function public.save_section_answers(p_x uuid)
returns void
language plpgsql
security definer
as $$ begin perform 1; end; $$;
