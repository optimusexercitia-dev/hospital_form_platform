-- Committee Charters & Meeting Cadence (S4·CH, Phase 21) — core table (CH-BE-2).
-- ADR docs/decisions/0080-committee-charters-cadence-model.md (D4/D6/D11);
-- build plan docs/plans/charters-cadence.md §2. No PHI (Rule 12).
--
-- `commission_charters` is a THIN 1:1-per-commission cadence-config row (PK =
-- commission_id) that optionally links the commission's regimento CONTROLLED DOCUMENT
-- (doc_type='regimento'). `sem_regimento` = the ABSENCE of a row (there is no null
-- charter). The regimento's content/dates live on the controlled document, not here (D2/D3).
--
-- Security posture (Rule 1; ADR 0078/0079): member-READ via RLS; NO authenticated
-- write policy — the sole write door is the DEFINER `upsert_commission_charter` RPC
-- (CH-BE-3). Foreign-commission → no read.
--
-- Catalog-verified names used here (live catalog, not migration text — CLAUDE.md graphify
-- exception; MEM §6.1 renamed the is_*_of family to has_role() shims):
--   • member predicate  = app.is_member_of(p_commission_id uuid) -> boolean
--       (STABLE SECURITY DEFINER; app.is_active(auth.uid()) AND has_role_any('commission',…))
--   • touch function    = app.touch_updated_at() (the shared generic BEFORE-UPDATE fn, D10)
--   • audit             = app.audit_write(p_action,…); audit_log.action has only a SHAPE
--       CHECK ('<noun>.<verb>', dot-separated) — NO enumerated verb allow-list in the DB.
--       The verb 'charter.upserted' is reader-REGISTERED in src/lib/queries/audit.ts
--       (AuditAction + AUDIT_ACTION_LABELS) and EMITTED by the CH-BE-3 RPC as
--       audit_write('charter.upserted','commission', p_commission, p_commission, …).
--       This migration adds no audit DDL.

-- -----------------------------------------------------------------------------
-- 1 · commission_charters — the thin cadence-config row (plan §2 DDL exactly)
-- -----------------------------------------------------------------------------
create table if not exists public.commission_charters (
  commission_id          uuid primary key
                           references public.commissions(id) on delete cascade,
  meeting_frequency      text not null
                           check (meeting_frequency in
                             ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral')),
  -- Nullable: a commission may set a cadence before it has a ratified regimento.
  -- ON DELETE SET NULL — dropping the doc leaves the cadence intact (sem_regimento
  -- reverts to "cadence-only", not the loss of the whole charter).
  controlled_document_id uuid references public.controlled_documents(id) on delete set null,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
comment on table public.commission_charters is
  'ADR 0080 D4 — thin 1:1-per-commission cadence-config (PK = commission_id) linking the '
  'regimento controlled document (doc_type=regimento). sem_regimento = no row. Member-READ '
  'RLS; writes DEFINER-RPC-only (upsert_commission_charter — CH-BE-3). No PHI (Rule 12).';

-- Reverse-lookup / FK-maintenance index (dropping a controlled document must find the
-- linking charter rows for the ON DELETE SET NULL).
create index commission_charters_controlled_document_idx
  on public.commission_charters (controlled_document_id)
  where controlled_document_id is not null;

-- -----------------------------------------------------------------------------
-- 2 · RLS — member-read only; NO write policy (DEFINER-RPC write door, CH-BE-3)
-- -----------------------------------------------------------------------------
alter table public.commission_charters enable row level security;

create policy commission_charters_select on public.commission_charters
  for select to authenticated
  using (app.is_member_of(commission_id));

grant select on public.commission_charters to authenticated;

-- -----------------------------------------------------------------------------
-- 3 · updated_at touch trigger (shared generic fn, D10)
-- -----------------------------------------------------------------------------
create trigger touch_commission_charters_updated_at
  before update on public.commission_charters
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 4 · Feature flag (OFF) — no prod-enabling migration (prod OFF till pilot, mirroring
--     ETH·E2); seed.sql forces it ON for local/E2E at CH-BE-5 (not touched here).
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values (
  'charters', false,
  'Regimento e cadência de reuniões da comissão (S4·CH, ADR 0080): periodicidade de '
  'reuniões + vínculo ao regimento (documento controlado), indicador de aderência à '
  'cadência e sugestão de itens a transportar ao agendar reunião. Desligado por padrão; '
  'ligado no gate do CH.'
)
on conflict (key) do update set description = excluded.description;
