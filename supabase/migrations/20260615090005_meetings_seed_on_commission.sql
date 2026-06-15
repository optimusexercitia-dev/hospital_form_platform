-- Phase 10 / B2: seed default meeting types + settings for every commission.
--
-- A fresh standalone seeder (there is NO existing commissions AFTER INSERT
-- trigger to extend — the case-status one was dropped in 20260614093000). Every
-- commission gets, idempotently:
--   * two meeting types: "Ordinária" and "Extraordinária" (positions 1, 2),
--   * one commission_meeting_settings row (the default quorum rule:
--     maioria_simples, quorum_value null).
-- so the schedule form's type picker and the quorum panel are populated from day
-- one. New commissions get them via the AFTER INSERT trigger below; existing
-- commissions are backfilled at the end of this migration.

-- ===========================================================================
-- app.seed_default_meeting_types(commission_id) -> void   (idempotent)
-- ===========================================================================
-- ON CONFLICT DO NOTHING on both inserts so it is safe to call repeatedly (the
-- trigger fires once per commission, the backfill once per existing commission,
-- and a future manual re-run is harmless). SECURITY DEFINER so the backfill /
-- trigger writes regardless of RLS.
create function app.seed_default_meeting_types(p_commission_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  insert into public.commission_meeting_types (commission_id, name, color_token, position)
  values
    (p_commission_id, 'Ordinária', 'blue', 1),
    (p_commission_id, 'Extraordinária', 'amber', 2)
  on conflict (commission_id, name) do nothing;

  insert into public.commission_meeting_settings (commission_id, quorum_rule_type, quorum_value)
  values (p_commission_id, 'maioria_simples', null)
  on conflict (commission_id) do nothing;
end;
$$;

revoke all on function app.seed_default_meeting_types(uuid) from public;
grant execute on function app.seed_default_meeting_types(uuid) to service_role;

-- ===========================================================================
-- app.seed_meetings_on_commission_insert — AFTER INSERT trigger on commissions
-- ===========================================================================
create function app.seed_meetings_on_commission_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.seed_default_meeting_types(new.id);
  return new;
end;
$$;

create trigger seed_meetings_on_commission_insert_trg
  after insert on public.commissions
  for each row execute function app.seed_meetings_on_commission_insert();

-- ===========================================================================
-- Backfill — every commission that already exists when this migration runs
-- ===========================================================================
do $$
declare
  r record;
begin
  for r in select id from public.commissions loop
    perform app.seed_default_meeting_types(r.id);
  end loop;
end $$;
