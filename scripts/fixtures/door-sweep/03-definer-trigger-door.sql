-- Catalog: app.assert_hospital_affiliation_has_org -> trigger, prosecdef=t, OUTSIDE domain.
-- A DOOR the arm cannot sweep: it must be IDENTIFIED and kept OUT of CASES.
create or replace function app.assert_hospital_affiliation_has_org()
returns trigger
language plpgsql
security definer
as $$ begin return new; end; $$;
