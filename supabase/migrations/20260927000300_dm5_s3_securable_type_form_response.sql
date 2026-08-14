-- =============================================================================
-- DM5 S3 · M1 — securable resource type `form_response`
--
-- Executes ADR 0120 D1 (the third and last new type) + D6 (prints home on
-- their SOURCE's securable resource, so all four `printed_documents.source_kind`
-- values have a home and the retirement manifest can close 8/8).
--
-- ⭐ THE COUPLING, restated because it is the reason this file exists at all.
-- `securable_resources` carries TWO constraints that each enumerate the type
-- set: `securable_resources_type_check` and `securable_resources_tenant_shape`.
-- Widening only the first leaves `tenant_shape` false for the new type and
-- EVERY insert is rejected — fail-closed, but silently. They are widened in ONE
-- edit here. pgTAP 341 block S3a exercises FOUR cases, not one: the new type
-- fully tenanted is ACCEPTED; the new type without a commission is REJECTED;
-- `capa_action` without a hospital is still REJECTED (shape B did not become a
-- hole); and the counterfactual — widening `type_check` alone still rejects.
--
-- ⭐ TENANCY: `form_response` joins shape A (org + hospital + commission all
-- NOT NULL). MEASURED, not assumed:
--   select attnotnull from pg_attribute
--    where attrelid = 'public.responses'::regclass and attname = 'commission_id'
--   → t
-- So all three anchors are derivable for every response and there is no reason
-- to relax the shape. The CHECK therefore still carries exactly TWO shapes
-- after this migration, not three — the *decision* was which shape the new type
-- takes, and the answer is shape A.
--
-- ⛔ WHAT THIS MIGRATION DELIBERATELY DOES **NOT** DO — no trigger on
-- `public.responses`, no `securable_type` pin column, no composite FK, and
-- therefore NO BACKFILL.
-- Every other type mints its registry row from a BEFORE INSERT trigger on its
-- own table. `responses` is deliberately different, on two grounds:
--   1. ADR 0120 D17.2 — "do NOT add a convenience backfill: with no backfill
--      the create path is the only path, so an untaught create path fails
--      immediately and loudly instead of silently." A trigger on `responses`
--      would require backfilling every existing response for the composite FK
--      to be addable, which is precisely the shape that masked DM3's P0.
--   2. VOLUME. `responses` is the product's highest-cardinality table (one row
--      per draft and per submission). A registry row per response would be a
--      permanent 1:1 shadow of that table in a SECURITY registry, minted for
--      every discarded draft, to support a feature (PDF emission) that is
--      explicitly invoked and rare.
-- Instead `public.mint_printed_document` ensures the registry row inline (M6),
-- so the ONLY path that creates one is the only path that needs one, and a bug
-- there fails at the `documents.home_resource_id` FK rather than silently.
--
-- 🔧 KNOWN, FAIL-CLOSED RESIDUAL (recorded, not fixed here): with no AFTER
-- DELETE trigger, deleting a response leaves its `securable_resources` row
-- behind. That is not a leak — `app.can_view_printed_document`'s
-- `form_response` arm resolves `public.responses` and returns FALSE when the
-- row is gone, so an orphaned home makes the print unviewable by everyone. A
-- `trg_drop_securable_resource` was considered and rejected for S3: it would
-- make `discard_response` RESTRICT-fail for any draft that had been emitted as
-- a PDF, which is a behaviour change to a shipped door and outside this slice.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- The two coupled CHECKs, widened together.
-- -----------------------------------------------------------------------------
alter table public.securable_resources
  drop constraint securable_resources_type_check,
  drop constraint securable_resources_tenant_shape;

alter table public.securable_resources
  add constraint securable_resources_type_check
  check (resource_type = any (array[
    'case', 'meeting', 'interview', 'action_item',
    'controlled_document', 'case_referral',
    'rca', 'capa_action',
    'form_response'
  ]));

-- Still TWO shapes. Shape A gains `form_response`; shape B (`capa_action`,
-- ADR 0120 D14) is reproduced verbatim and is NOT relaxed further.
alter table public.securable_resources
  add constraint securable_resources_tenant_shape
  check (
    (
      resource_type = any (array[
        'case', 'meeting', 'interview', 'action_item',
        'controlled_document', 'case_referral', 'rca',
        'form_response'
      ])
      and organization_id is not null
      and hospital_id is not null
      and commission_id is not null
    )
    or (
      resource_type = 'capa_action'
      and organization_id is not null
      and hospital_id is not null
      -- commission_id deliberately unconstrained (D14)
    )
  );

-- -----------------------------------------------------------------------------
-- Self-verification at apply time — STRUCTURAL ONLY, and the reason why is a
-- finding worth keeping.
--
-- ⭐ THIS BLOCK ORIGINALLY INSERTED PROBE ROWS to prove both tenant-shape
-- directions behaviourally. It passed `supabase migration up` (which runs
-- against an already-seeded database) and was then **FALSIFIED BY A FRESH
-- RESET**: migrations run BEFORE `seed.sql`, so `public.organizations`,
-- `public.hospitals` and `public.commissions` are all EMPTY here, and
-- `securable_resources`' three FKs make ANY probe insert impossible. The
-- migration aborted the reset with its own `raise`.
--
-- ⚠ So the `migration up` green was a FALSE POSITIVE — the exact shape this
-- phase already paid for once at `…000120`: **"file and DB agree" is not "the
-- file works", and an assertion that has never executed in the real pre-state
-- is unproven no matter how green it looks.** The lesson generalizes past
-- migration text: NO migration in this repo can assert tenancy-dependent
-- BEHAVIOUR, because there is no tenancy yet when it runs.
--
-- The split that follows from that: this block asserts what is true at apply
-- time (both coupled CHECKs exist and both enumerate the new type — the
-- half-widening catcher, the same shape as pgTAP 330 DM3·R2b), and the four
-- BEHAVIOURAL cases live in pgTAP 342 block S3a, which runs against the seed.
-- -----------------------------------------------------------------------------
do $$
declare
  v_named int;
begin
  -- `pg_get_constraintdef` is Postgres's own rendering of the PARSED node, not
  -- the file's text, so this survives a reformat of this file. It is still a
  -- substring test and is therefore deliberately NOT the whole assurance — it
  -- catches a half-widening; 342 S3a proves the shapes discriminate.
  select count(*) into v_named
    from pg_constraint
   where conrelid = 'public.securable_resources'::regclass
     and conname in ('securable_resources_type_check',
                     'securable_resources_tenant_shape')
     and pg_get_constraintdef(oid) like '%form_response%';
  if v_named <> 2 then
    raise exception
      'DM5 S3 M1: form_response is named by % of the 2 coupled CHECKs (half-widening)', v_named;
  end if;

  -- Shape B must still be present and must still be the ONLY relaxed shape:
  -- exactly one disjunct mentions capa_action, and it is not this migration's.
  if (select count(*) from pg_constraint
       where conrelid = 'public.securable_resources'::regclass
         and conname = 'securable_resources_tenant_shape'
         and pg_get_constraintdef(oid) like '%capa_action%') <> 1 then
    raise exception 'DM5 S3 M1: tenant_shape lost the D14 capa_action shape';
  end if;
end;
$$;

commit;
