-- AE4.1 assignment binding [PA-F1, ADR 0162 §2 item 2] — bind assignment storage to the
-- catalog. Rulings, measurements and the ADR: 0172.
--
-- Sequenced as its own migration ON PURPOSE. ADR 0162 §2 item 2 orders this "once every
-- role has a catalog row"; three files make that dependency visible in the file listing
-- rather than burying it in one file's statement order, and make an attribution failure
-- attributable.
--
-- ============================================================================
-- WHY A GENERATED COLUMN AND NOT A TRIGGER + CHECK. Three reasons, heaviest first.
--
--   1. ⭐ A GENERATION EXPRESSION CANNOT REFERENCE ANOTHER TABLE. That makes Architecture
--      Rule 13 STRUCTURALLY UNEXPRESSIBLE here rather than merely asserted: a future edit
--      that folds an affiliation lookup into this discriminator will not compile. A
--      trigger could perform that lookup silently. An affiliation LOCATES; a memberships
--      row GRANTS; `scope_kind` is derived from the GRANT's own scope columns and reads
--      no affiliation table because it CANNOT.
--   2. It cannot be switched off. `alter table ... disable trigger` and
--      `session_replication_role = replica` both defeat a trigger — and this tree has
--      already been bitten by replica mode defeating FK CASCADE.
--   3. `add column ... generated ... stored` computes for every existing row during the
--      rewrite, so there is no backfill statement to get wrong; and the column cannot be
--      written explicitly, so no door can set it inconsistently with the columns it is
--      derived from. Verified safe for the sole write path: app.grant_role_impl is the
--      ONLY function that inserts into public.memberships and it uses an EXPLICIT NAMED
--      column list (principal_id, organization_id, hospital_id, commission_id, role,
--      title_id, granted_by, expires_at) which does not name scope_kind.
--      public.assign_member_title updates title_id only. No dependent views exist.
--
-- ⚠ REFERENTIAL ACTIONS ARE MEASURED, NOT ASSUMED (PostgreSQL 17.6, 2026-09-01, in
-- rolled-back transactions against a generated referencing column):
--       on delete cascade    ACCEPTED      on update cascade      REJECTED
--       on delete restrict   ACCEPTED      on update restrict     ACCEPTED
--       on delete no action  ACCEPTED      on update no action    ACCEPTED
--       on delete set null   REJECTED      on update set null     REJECTED
--       on delete set default REJECTED
--   ("invalid ON {UPDATE,DELETE} action for foreign key constraint containing generated
--   column".)
--
--   ⛔ `on delete cascade` IS LEGAL HERE AND IS EXACTLY WHAT WE MUST NOT USE: it would
--   make deleting one catalog row a SILENT MASS REVOCATION of every membership holding
--   that role. RESTRICT fails the migration loudly instead. Both actions are stated
--   explicitly rather than defaulted to NO ACTION, so the choice is visible.
--
--   ⚠ CONSEQUENCE FOR AE5, stated here rather than discovered there: because
--   `on update cascade` is ILLEGAL on a generated referencing column, a role code can
--   never be renamed by UPDATE while assignments exist. AE4.2 fixes codes to the existing
--   enum literals, so this costs nothing today — but a future rename is a data migration,
--   not an UPDATE.
--
-- ⭐⭐ WHY `MATCH FULL`, AND IT IS THE LOAD-BEARING CHOICE. Under the DEFAULT
-- (MATCH SIMPLE) this FK is a LABEL, not a control: a composite FK is satisfied
-- VACUOUSLY whenever ANY referencing column is NULL. Measured on a scratch table shaped
-- like memberships but WITHOUT the legacy CHECKs:
--       MATCH SIMPLE : insert (scope_kind = NULL, role = 'TOTALLY_FAKE_ROLE')  ACCEPTED
--       MATCH FULL   : the same insert                                        REJECTED
--                      ("MATCH FULL does not allow mixing of null and nonnull key values")
--       MATCH FULL   : a valid fully-scoped row                               ACCEPTED
-- Since `role` is NOT NULL, MATCH FULL turns the constraint into the proposition we
-- actually want: EVERY memberships row must derive a scope kind AND have a catalog row
-- for the pair. This is the "a guard that reads right but fails open" class.
--
-- ⚠⚠ WHAT THIS FK MEASURES TODAY vs WHAT IT IS FOR — read this before citing it as
-- evidence. On the REAL memberships table, with the legacy CHECKs standing and the
-- catalog complete, the MATCH SIMPLE hole is NOT REACHABLE, and not because of this FK:
--   * scope_kind is GENERATED, so NULL requires all three scope columns NULL;
--   * memberships_role_check rejects an unknown role outright;
--   * memberships_scope_shape's `ELSE false` rejects any unknown role regardless of scope
--     columns, and rejects a KNOWN role with all-NULL scope columns too.
-- So today this constraint is DOUBLY COVERED, and a green keystone on the real table
-- would be measuring memberships_role_check, not MATCH FULL. "Not reachable" is not
-- "protected". MATCH FULL's value here is PROSPECTIVE: it is the control that SURVIVES
-- the AE5-complete retirement of those two CHECKs. Suite 401 partitions the evidence
-- accordingly (§7 scratch-table differential, §8 real-table FK existence, §9 the
-- reachability statement naming which control actually fires today).
-- ============================================================================

alter table public.memberships
  add column scope_kind authz.scope_kind
  generated always as (
    case
      when commission_id   is not null then 'commission'
      when hospital_id     is not null then 'hospital'
      when organization_id is not null then 'organization'
    end
  ) stored;

comment on column public.memberships.scope_kind is
  'Carried scope discriminator (ADR 0162 §2 item 2). GENERATED from this row''s own scope '
  'columns — never from an affiliation, which a generation expression cannot even '
  'reference (Architecture Rule 13, structurally enforced). Ordered commission -> '
  'hospital -> organization because a hospital-tier row sets BOTH organization_id and '
  'hospital_id; the first matching branch is the NARROWEST scope, which is the one that '
  'names the tier. ⛔ Grants nothing. It only narrows WHICH catalog row a grant may '
  'reference. The actual scope-column shape stays enforced independently by '
  'memberships_scope_shape (ADR 0162 §2 item 3).';

-- ============================================================================
-- Pre-flight guard. ⛔ NOT redundant with the ADD CONSTRAINT that follows.
--
-- Local data is clean (measured: 43 rows, 0 scopeless, exactly the 10 expected pairs) and
-- that proves NOTHING about production. This is a data-dependent migration whose real
-- work happens at `db push` — the standing "a backfill guard-wrap passes local reset and
-- fails db push on data" lesson. ADD CONSTRAINT's own error names the CONSTRAINT, not the
-- offending rows; this raises with the offending (role, scope_kind, count) list, which is
-- the difference between a five-minute diagnosis and an hour of it.
--
-- A row that fails here is a LIVE AUTHORIZATION ANOMALY — a membership whose role/scope
-- pair no catalog row sanctions — and is a PO question, not a migration bug to code
-- around.
--
-- One `do $$` block, no top-level SET LOCAL (plan rule 8 / lint:set-local).
-- ============================================================================

do $$
declare
  v_offenders text;
begin
  select string_agg(
           format('(role=%L, scope_kind=%L, rows=%s)', role, scope_kind, n),
           ', ' order by role, scope_kind)
    into v_offenders
  from (
    select m.role, m.scope_kind::text as scope_kind, count(*) as n
      from public.memberships m
     where m.scope_kind is null
        or not exists (
              select 1 from authz.roles r
               where r.code = m.role
                 and r.allowed_scope_kind = m.scope_kind
            )
     group by 1, 2
  ) s;

  if v_offenders is not null then
    raise exception
      'AE4 assignment binding aborted: % memberships row group(s) have no sanctioning '
      'authz.roles row. Offenders: %. Each is a live authorization anomaly — a role/scope '
      'pair the catalog does not sanction. Resolve the data or seed the catalog row; do '
      'not weaken the constraint.',
      (select count(*) from (select 1 from public.memberships m
         where m.scope_kind is null
            or not exists (select 1 from authz.roles r
                            where r.code = m.role and r.allowed_scope_kind = m.scope_kind)
         group by m.role, m.scope_kind) x),
      v_offenders
      using errcode = 'check_violation';
  end if;
end $$;

alter table public.memberships
  add constraint memberships_role_scope_kind_fkey
  foreign key (role, scope_kind)
  references authz.roles (code, allowed_scope_kind)
  match full
  on update restrict on delete restrict;

comment on constraint memberships_role_scope_kind_fkey on public.memberships is
  'The AE4 assignment binding (ADR 0162 §2 item 2, ADR 0172). MATCH FULL is load-bearing: '
  'under the default MATCH SIMPLE a NULL scope_kind satisfies this vacuously with ANY '
  'role value (measured). ⚠ Today it is doubly covered by memberships_role_check and '
  'memberships_scope_shape; its value is PROSPECTIVE — it is the control that survives '
  'their retirement at AE5-complete. ⛔ Until that retirement the catalog is '
  'AUTHORITY-ELECT, not the authority.';
