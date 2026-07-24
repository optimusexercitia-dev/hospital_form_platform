-- Case Correction Lifecycle — BE-5 case_reopenings (durable reopen justification).
--
-- Resolves the BE-4 tension (PO ruling): reopen_case takes a MANDATORY reason that
-- must be DURABLY recorded, while free text must NOT enter the hash-chained audit
-- log (Rule 11). An append-only child table is the resolution — the reason lives
-- here (RLS-scoped to case readers), not in the audit payload.
--
-- Writes are door-only (app.in_reopen_rpc, set inside reopen_case); the row is
-- append-only (UPDATE/DELETE blocked). authenticated gets an EXPLICIT SELECT grant
-- (the BE-1 dead-grant lesson).

create table public.case_reopenings (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases(id) on delete cascade,
  reason       text not null,
  reopened_by  uuid references public.profiles(id),
  reopened_at  timestamptz not null default now(),

  constraint case_reopenings_reason_not_blank check (btrim(reason) <> '')
);

comment on table public.case_reopenings is
  'Append-only durable record of each case reopening (reopen_case). reason is a '
  'governance justification, RLS-scoped to case readers — kept OUT of the audit '
  'log (Rule 11). Written only inside reopen_case (app.in_reopen_rpc).';

create index case_reopenings_case_id_idx on public.case_reopenings (case_id);

-- Write guard: INSERT only under app.in_reopen_rpc (the door); UPDATE always blocked;
-- DELETE only via parent-case cascade (mirrors the narrative-revisions append-only guard).
create or replace function app.guard_case_reopening_write()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if tg_op = 'UPDATE' then
    raise exception 'os registros de reabertura são imutáveis (somente inserção)'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    if not exists (select 1 from public.cases where id = old.case_id) then
      return old;  -- parent gone → cascade delete, allow
    end if;
    raise exception 'os registros de reabertura são imutáveis (exclusão bloqueada)'
      using errcode = 'check_violation';
  end if;

  -- INSERT.
  if coalesce(current_setting('app.in_reopen_rpc', true), 'off') <> 'on' then
    raise exception 'as reaberturas só podem ser registradas pela rotina de reabertura'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create trigger guard_case_reopenings_write_trg
  before insert or update or delete on public.case_reopenings
  for each row execute function app.guard_case_reopening_write();

alter table public.case_reopenings enable row level security;

revoke insert, update, delete, truncate on public.case_reopenings from authenticated;
grant select on public.case_reopenings to authenticated;   -- EXPLICIT (BE-1 dead-grant lesson)

create policy case_reopenings_select on public.case_reopenings
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- reopen_case now persists the reason into case_reopenings (same transaction as
-- the status flip). Reproduced from the live body; only the INSERT is added.
-- ---------------------------------------------------------------------------
create or replace function public.reopen_case(p_case_id uuid, p_reason text)
returns cases
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_status text; v_commission uuid; v_reason text; v_result public.cases;
begin
  perform app.assert_case_corrections_enabled();

  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(p_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;

  select status into v_status from public.cases where id = p_case_id;
  if v_status = 'cancelled' then
    raise exception 'caso cancelado é definitivo' using errcode = 'HC0M8';
  end if;
  if v_status <> 'completed' then
    raise exception 'apenas casos concluídos podem ser reabertos' using errcode = 'check_violation';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'informe o motivo da reabertura' using errcode = 'check_violation';
  end if;

  -- Placeholder (non-terminal) so recompute_case_status will run; clear closed_*;
  -- record the durable reason — all under app.in_reopen_rpc.
  perform set_config('app.in_case_rpc', 'on', true);
  perform set_config('app.in_reopen_rpc', 'on', true);
  update public.cases
    set status = 'pending', closed_at = null, closed_by = null
    where id = p_case_id;
  insert into public.case_reopenings (case_id, reason, reopened_by)
    values (p_case_id, v_reason, auth.uid());
  perform set_config('app.in_reopen_rpc', 'off', true);
  perform set_config('app.in_case_rpc', 'off', true);

  -- Settle the real derived status from the phases (in_review / pending / not_started).
  perform app.recompute_case_status(p_case_id);

  select * into v_result from public.cases where id = p_case_id;

  -- Structured audit only; the free-text reason lives on case_reopenings (Rule 11).
  perform app.audit_write('case.reopened', 'case', p_case_id, v_commission,
    'Caso reaberto', jsonb_build_object('previous_status', 'completed'));

  return v_result;
end;
$function$;
