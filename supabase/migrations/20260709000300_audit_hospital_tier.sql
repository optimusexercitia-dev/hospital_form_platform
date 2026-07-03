-- =============================================================================
-- Phase A · A3 — Audit gains a 4th HOSPITAL tier (ADR 0051 Decision 5)
-- =============================================================================
-- THE CODEBASE'S MOST DANGEROUS EDIT: the tamper-evident hash chain. Rewritten
-- IN LOCKSTEP in this one migration — audit_canonical + audit_write +
-- verify_audit_chain + the partial-unique seq indexes + the read policy — so no
-- intermediate state has a canonical tuple that disagrees across the three fns.
--
-- Chain key becomes (organization_id, hospital_id, commission_id) with four
-- shapes by PRECEDENCE:
--   commission | org set, hospital set (DERIVED), commission set | lock c:<comm>
--   hospital   | org set, hospital set, commission NULL            | lock h:<hosp>
--   org        | org set, hospital NULL, commission NULL           | lock o:<org>
--   platform   | all NULL                                          | lock p
--
-- Commission-tier rows CARRY the trigger-derived hospital_id in the HASHED tuple
-- (ADR 0051 Decision 5 / Q3): each row still chains to exactly ONE predecessor
-- (the commission chain is keyed on commission_id ALONE — no double-chaining);
-- the hospital column is stored + hashed so it can't be tampered and so a
-- hospital-level READ ROLLUP can span its commissions' rows. commission_id-NULL
-- hospital-tier rows are reserved for genuinely hospital-level events ONLY
-- (hospital edits, hospital_admin grant/revoke).
--
-- The canonical tuple now includes hospital_id (spliced right after
-- organization_id). This CHANGES EVERY row_hash — acceptable ONLY because we
-- greenfield-reseed pre-launch (no historical chain to preserve).
--
-- NOTE (consistency call, flagged): audit_log.organization_id carries NO FK
-- (edits/archival only, never dropped; ADR 0029). hospital_id is added the same
-- way (nullable, FK-less) to match that established pattern and avoid a NO ACTION
-- delete-ordering hazard — a deliberate, minor departure from the plan's "FK ON
-- DELETE NO ACTION" wording, not a change to the chain design.
-- =============================================================================

-- 1. The hospital column (nullable; part of the hashed canonical tuple).
alter table public.audit_log add column if not exists hospital_id uuid;
comment on column public.audit_log.hospital_id is
  'Tenant hospital for this audit row (ADR 0051). Commission-tier rows carry the DERIVED hospital (from the commission) for hospital-level read rollup; hospital-tier rows set it with commission_id NULL; org/platform rows leave it NULL. Part of the hashed canonical tuple. FK-less to match organization_id (never dropped; ADR 0029).';

-- 2. audit_canonical — add p_hospital_id, splice AFTER organization_id.
create or replace function app.audit_canonical(
  p_seq bigint, p_occurred_at timestamptz, p_actor_id uuid, p_actor_is_admin boolean,
  p_commission_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_summary text, p_metadata jsonb,
  p_organization_id uuid default null,
  p_hospital_id uuid default null
) returns text
  language sql immutable
  set search_path to 'app', 'pg_catalog'
as $$
  select concat_ws(
    chr(30),  -- U+001E record separator
    p_seq::text,
    to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(p_actor_id::text, ''),
    case when p_actor_is_admin then 'true' else 'false' end,
    coalesce(p_organization_id::text, ''),
    coalesce(p_hospital_id::text, ''),
    coalesce(p_commission_id::text, ''),
    p_action,
    p_entity_type,
    p_entity_id::text,
    p_summary,
    app.jsonb_canonical(p_metadata)
  );
$$;
alter function app.audit_canonical(bigint, timestamptz, uuid, boolean, uuid, text, text, uuid, text, jsonb, uuid, uuid) owner to postgres;

-- Drop the OLD 11-arg overload (CREATE OR REPLACE with a new arg count makes a
-- NEW overload rather than replacing — the extra trailing p_hospital_id created a
-- second function). Removing it leaves the 12-arg version as the sole canonical
-- fn (its trailing param defaults, so no caller needs updating).
drop function if exists app.audit_canonical(bigint, timestamptz, uuid, boolean, uuid, text, text, uuid, text, jsonb, uuid);

-- 3. audit_write — add trailing p_hospital; derive hospital from commission;
--    precedence commission -> hospital -> org -> platform.
create or replace function app.audit_write(
  p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid,
  p_summary text, p_metadata jsonb default '{}'::jsonb,
  p_organization uuid default null,
  p_hospital uuid default null
) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_seq bigint;
  v_prev_hash text;
  v_occurred timestamptz := now();
  v_lock_key text;
  v_row_hash text;
  v_org uuid := p_organization;
  v_hospital uuid := p_hospital;
begin
  if not app.feature_enabled('audit_trail') then
    return;
  end if;

  if v_actor is not null then
    v_actor_is_admin := coalesce(app.is_admin(), false);
  end if;

  -- Derive org + hospital from the commission when a commission was passed (the
  -- ~62 trg_audit_* callers do exactly this). A commission ALWAYS belongs to a
  -- hospital + org (post-reseed) -> the commission row is org-set + hospital-set +
  -- commission-set.
  if p_commission is not null then
    select organization_id, hospital_id into v_org, v_hospital
    from public.commissions where id = p_commission;
  end if;

  -- The CHAIN is identified by PRECEDENCE (matching verify_audit_chain):
  --   commission set -> commission chain (keyed on commission_id ALONE)
  --   hospital set    -> hospital chain   (hospital_id, commission NULL)
  --   org set         -> org chain        (organization_id, hospital + commission NULL)
  --   else            -> platform chain   (all NULL)
  -- Keying the commission chain on commission_id alone keeps seq monotonic per
  -- commission (matching audit_log_commission_seq_key) even though the row also
  -- carries the derived hospital_id: the hospital column is for READ ROLLUP, it
  -- does NOT re-chain the row.
  if p_commission is not null then
    v_lock_key := 'audit:c:' || p_commission::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where commission_id = p_commission
    order by seq desc limit 1;
  elsif v_hospital is not null then
    v_lock_key := 'audit:h:' || v_hospital::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where hospital_id = v_hospital and commission_id is null
    order by seq desc limit 1;
  elsif v_org is not null then
    v_lock_key := 'audit:o:' || v_org::text;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where organization_id = v_org and hospital_id is null and commission_id is null
    order by seq desc limit 1;
  else
    v_lock_key := 'audit:p';
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select seq, row_hash into v_seq, v_prev_hash
    from public.audit_log
    where organization_id is null and hospital_id is null and commission_id is null
    order by seq desc limit 1;
  end if;

  v_seq := coalesce(v_seq, 0) + 1;

  v_row_hash := encode(
    extensions.digest(
      coalesce(v_prev_hash, '') || app.audit_canonical(
        v_seq, v_occurred, v_actor, v_actor_is_admin, p_commission,
        p_action, p_entity_type, p_entity_id, p_summary,
        coalesce(p_metadata, '{}'::jsonb), v_org, v_hospital
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_log (
    occurred_at, organization_id, hospital_id, commission_id, actor_id, actor_is_admin,
    action, entity_type, entity_id, summary, metadata,
    seq, prev_hash, row_hash
  ) values (
    v_occurred, v_org, v_hospital, p_commission, v_actor, v_actor_is_admin,
    p_action, p_entity_type, p_entity_id, p_summary,
    coalesce(p_metadata, '{}'::jsonb),
    v_seq, v_prev_hash, v_row_hash
  );
end;
$$;
alter function app.audit_write(text, text, uuid, uuid, text, jsonb, uuid, uuid) owner to postgres;

-- Drop the OLD 7-arg overload (same CREATE-OR-REPLACE-new-arg-count reason). The
-- ~62 trg_audit_* callers pass <= 7 positional args and now bind to the 8-arg fn
-- via the defaulted trailing p_hospital.
drop function if exists app.audit_write(text, text, uuid, uuid, text, jsonb, uuid);

-- 4. Partial-unique seq indexes: drop the 3 old (3-tier), create 4.
drop index if exists public.audit_log_commission_seq_key;
drop index if exists public.audit_log_org_seq_key;
drop index if exists public.audit_log_platform_seq_key;

-- commission: keyed on commission_id ALONE (unchanged shape).
create unique index audit_log_commission_seq_key
  on public.audit_log (commission_id, seq) where commission_id is not null;
-- hospital: hospital set, commission null.
create unique index audit_log_hospital_seq_key
  on public.audit_log (hospital_id, seq)
  where hospital_id is not null and commission_id is null;
-- org: org set, hospital null, commission null.
create unique index audit_log_org_seq_key
  on public.audit_log (organization_id, seq)
  where organization_id is not null and hospital_id is null and commission_id is null;
-- platform: all null.
create unique index audit_log_platform_seq_key
  on public.audit_log (seq)
  where organization_id is null and hospital_id is null and commission_id is null;

-- 5. verify_audit_chain — add p_hospital; 4-tier authz + enumeration; hash
--    recompute passes v_rec.hospital_id in the same canonical position.
create or replace function public.verify_audit_chain(
  p_commission uuid default null,
  p_organization uuid default null,
  p_hospital uuid default null
) returns table(ok boolean, broken_seq bigint)
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_rec record;
  v_prev_hash text;
  v_expected text;
  v_chain_org uuid;
  v_chain_hosp uuid;
  v_chain_comm uuid;
begin
  perform app.assert_audit_enabled();

  -- Authorization, per tier (precedence commission -> hospital -> org -> platform).
  if p_commission is not null then
    if not (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission)) then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  elsif p_hospital is not null then
    -- hospital chain: hospital_admin of the hospital OR org_admin of its org.
    if not (app.is_hospital_admin_of(p_hospital)
            or app.is_org_admin_of((select organization_id from public.hospitals where id = p_hospital))) then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  elsif p_organization is not null then
    if not app.is_org_admin_of(p_organization) then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  else
    if not app.is_admin() then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  end if;

  -- Build the chain identity to verify, BY PRECEDENCE (matching audit_write):
  --   commission set        -> commission chain (enumerate by commission_id alone)
  --   hospital set, comm 0  -> hospital chain   (hospital_id, commission NULL)
  --   org set, hosp+comm 0  -> org chain        (organization_id, hospital+commission NULL)
  --   all 0                 -> platform chain   (all NULL)
  for v_chain_org, v_chain_hosp, v_chain_comm in
    select o, h, c from (
      select null::uuid as o, null::uuid as h, p_commission as c
        where p_commission is not null
      union all
      select null::uuid as o, p_hospital as h, null::uuid as c
        where p_commission is null and p_hospital is not null
      union all
      select p_organization as o, null::uuid as h, null::uuid as c
        where p_commission is null and p_hospital is null and p_organization is not null
      union all
      select null::uuid as o, null::uuid as h, null::uuid as c
        where p_commission is null and p_hospital is null and p_organization is null
    ) chains
  loop
    v_prev_hash := null;
    for v_rec in
      select * from public.audit_log
      where (
              -- commission tier: keyed on commission_id ALONE
              (v_chain_comm is not null and commission_id = v_chain_comm)
              -- hospital tier: hospital_id set, commission NULL
              or (v_chain_comm is null and v_chain_hosp is not null
                  and hospital_id = v_chain_hosp and commission_id is null)
              -- org tier: organization_id set, hospital + commission NULL
              or (v_chain_comm is null and v_chain_hosp is null and v_chain_org is not null
                  and organization_id = v_chain_org and hospital_id is null and commission_id is null)
              -- platform tier: all NULL
              or (v_chain_comm is null and v_chain_hosp is null and v_chain_org is null
                  and organization_id is null and hospital_id is null and commission_id is null)
            )
      order by seq asc
    loop
      v_expected := encode(
        extensions.digest(
          coalesce(v_prev_hash, '') || app.audit_canonical(
            v_rec.seq, v_rec.occurred_at, v_rec.actor_id, v_rec.actor_is_admin,
            v_rec.commission_id, v_rec.action, v_rec.entity_type, v_rec.entity_id,
            v_rec.summary, v_rec.metadata, v_rec.organization_id, v_rec.hospital_id
          ),
          'sha256'
        ),
        'hex'
      );
      if v_rec.prev_hash is distinct from v_prev_hash or v_rec.row_hash <> v_expected then
        ok := false;
        broken_seq := v_rec.seq;
        return next;
        return;
      end if;
      v_prev_hash := v_rec.row_hash;
    end loop;
  end loop;

  ok := true;
  broken_seq := null;
  return next;
end;
$$;
alter function public.verify_audit_chain(uuid, uuid, uuid) owner to postgres;

-- The old 2-arg verify_audit_chain is superseded by the 3-arg overload with a
-- defaulted p_hospital; drop it so the signature is unambiguous for PostgREST.
drop function if exists public.verify_audit_chain(uuid, uuid);

-- 6. Read policy — 4 tiers (ADR 0051 Decision 5 / design decision 10). Gives
--    hospital_admin BOTH its hospital-tier rows AND (via is_commission_admin_of)
--    its hospital's commission-tier rows.
drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (
    app.is_staff_admin_of(commission_id)                              -- commission rows (staff_admin)
    or app.is_commission_admin_of(commission_id)                      -- commission rows (org OR hospital admin)
    or (commission_id is null and app.is_hospital_admin_of(hospital_id))  -- hospital-tier rows
    or (hospital_id is null and commission_id is null and app.is_org_admin_of(organization_id))  -- org tier
    or (organization_id is null and commission_id is null and app.is_admin())  -- platform tier
  );

-- 7. Hospital-level emitters — genuinely hospital-level events (commission_id
--    NULL, hospital set). Commission lifecycle STAYS on the commission tier
--    (Q3): those rows already carry the derived hospital_id for rollup.

-- 7a. hospitals UPDATE (name/slug edit) -> hospital.updated on the hospital tier.
create or replace function app.trg_audit_hospital_updated()
  returns trigger language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if new.name is distinct from old.name or new.slug::text is distinct from old.slug::text then
    perform app.audit_write(
      'hospital.updated', 'hospital', new.id, null,
      'Hospital atualizado: ' || new.name,
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['name','slug']),
      new.organization_id, new.id
    );
  end if;
  return new;
end;
$$;
alter function app.trg_audit_hospital_updated() owner to postgres;

drop trigger if exists trg_audit_hospital_updated on public.hospitals;
create trigger trg_audit_hospital_updated
  after update on public.hospitals
  for each row execute function app.trg_audit_hospital_updated();

-- 7b. organization_members INSERT/DELETE where role='hospital_admin' ->
--     hospital.admin_granted / hospital.admin_revoked on the hospital tier.
create or replace function app.trg_audit_hospital_admin_grant()
  returns trigger language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if tg_op = 'INSERT' and new.role = 'hospital_admin' then
    perform app.audit_write(
      'hospital.admin_granted', 'organization_member', new.id, null,
      'Administrador de hospital concedido',
      jsonb_build_object('user_id', new.user_id),
      new.organization_id, new.hospital_id
    );
    return new;
  elsif tg_op = 'DELETE' and old.role = 'hospital_admin' then
    perform app.audit_write(
      'hospital.admin_revoked', 'organization_member', old.id, null,
      'Administrador de hospital revogado',
      jsonb_build_object('user_id', old.user_id),
      old.organization_id, old.hospital_id
    );
    return old;
  end if;
  return coalesce(new, old);
end;
$$;
alter function app.trg_audit_hospital_admin_grant() owner to postgres;

drop trigger if exists trg_audit_hospital_admin_grant on public.organization_members;
create trigger trg_audit_hospital_admin_grant
  after insert or delete on public.organization_members
  for each row execute function app.trg_audit_hospital_admin_grant();
