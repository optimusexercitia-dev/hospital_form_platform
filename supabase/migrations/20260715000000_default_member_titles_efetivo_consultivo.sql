-- =============================================================================
-- Default committee member-title vocabulary — add "Membro Efetivo" / "Membro
-- Consultivo" (ADR 0051 Decision 6; display-only titles).
-- =============================================================================
-- Routine ADDITIVE vocabulary change. Two new DEFAULT titles are appended after
-- the existing three (Presidente / Vice-Presidente / Secretário(a)):
--   4. Membro Efetivo
--   5. Membro Consultivo
--
-- Titles remain DISPLAY-ONLY — zero RLS/access semantics; a titled `staff` gains
-- no extra rights. Two changes:
--   (a) redefine app.seed_default_member_titles so every NEWLY-created commission
--       auto-seeds all five defaults;
--   (b) idempotently backfill the two new titles onto every EXISTING commission,
--       appended after each commission's current max position.
-- =============================================================================

-- (a) Redefine the auto-seed function to insert FIVE defaults. Same signature,
--     SECURITY DEFINER, search_path, owner and conflict handling as the original
--     definition in 20260709000100_commission_titles.sql.
create or replace function app.seed_default_member_titles(p_commission_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  insert into public.commission_member_titles (commission_id, name, position)
  values
    (p_commission_id, 'Presidente', 1),
    (p_commission_id, 'Vice-Presidente', 2),
    (p_commission_id, 'Secretário(a)', 3),
    (p_commission_id, 'Membro Efetivo', 4),
    (p_commission_id, 'Membro Consultivo', 5)
  on conflict (commission_id, name) do nothing;
end;
$$;
alter function app.seed_default_member_titles(uuid) owner to postgres;

comment on function app.seed_default_member_titles(uuid) is
  'Seeds the default committee titles (Presidente/Vice-Presidente/Secretário(a)/Membro Efetivo/Membro Consultivo) for a new commission (ADR 0051). Editable/deletable afterward.';

comment on table public.commission_member_titles is
  'Per-commission member-title vocabulary (ADR 0051 Decision 6). DISPLAY-ONLY — zero RLS/access semantics. Managed by the commission staff_admin (admins inherit via is_commission_admin_of). Auto-seeded Presidente/Vice-Presidente/Secretário(a)/Membro Efetivo/Membro Consultivo on commission create.';

-- (b) Backfill EXISTING commissions with the two new defaults. Idempotent and
--     position-safe: each new title is appended after the commission's current
--     max position (both new rows see the SAME pre-existing max, so
--     Efetivo -> max+1 and Consultivo -> max+2: distinct positions, no collision
--     with the unique(commission_id, position) constraint). Re-running inserts 0
--     rows (guarded by NOT EXISTS + on conflict do nothing).
insert into public.commission_member_titles (commission_id, name, position)
select c.id, v.name,
       (select coalesce(max(t.position), 0)
          from public.commission_member_titles t
         where t.commission_id = c.id) + v.ord
from public.commissions c
cross join (values ('Membro Efetivo', 1), ('Membro Consultivo', 2)) as v(name, ord)
where not exists (
  select 1 from public.commission_member_titles t
  where t.commission_id = c.id and t.name = v.name
)
on conflict (commission_id, name) do nothing;
