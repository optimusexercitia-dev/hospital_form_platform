-- AE5 increment 1 — REPAIR: rebuild the implication closure after T4 seeded 18 permissions.
--
-- ⛔⛔ T4 (`20261003007440`) INSERTED 18 CODES AND LEFT THE SEED FUNCTIONALLY INERT. Forward-only,
-- so that migration is not edited (CLAUDE.md § 8); this one repairs it.
--
-- WHAT WAS WRONG. `authz.entailed_grants` — the body both resolvers call — joins the materialised
-- closure:
--
--     join authz.permission_implication_closure cl
--       on cl.implying = rp.permission_code and cl.implied = p_permission_code
--
-- The closure is materialised at MIGRATION time, by design (AE4.4's [PA-F6] ruling: the runtime
-- resolver must be non-recursive indexed lookups, so "the same migration that edits
-- `permission_implications` rebuilds the closure"). A permission with no closure row has no
-- REFLEXIVE edge, so `cl.implying = <granted code> and cl.implied = <same code>` matches nothing
-- and the grant resolves FALSE however correctly it was seeded.
--
-- MEASURED BEFORE THIS MIGRATION, on the live catalog:
--   * `authz.permission_implication_closure` held 43 rows against 61 permissions;
--   * 18 permissions had NO reflexive edge (`where not exists (… implying = code and implied = code)`);
--   * `authz.has_permission(<chefe.ccih>, 'commission', <CCIH>, 'commission.forms.read')` returned
--     **false** for a `staff_admin` that holds the grant and whose role is `authoritative`.
--
-- ⭐ HOW IT WAS CAUGHT, because the shape is worth keeping. pgTAP `409 § 5.5` asserts a NAMED LIST
-- of the codes a fixture `staff_admin` fails, not a count. The count arm would have read "18 more
-- failures" — a number to bump while moving the other AE5 pins, and the seed would have stayed
-- inert behind a green suite. The list named all 18 new codes, and a list of exactly the codes
-- just added is not a pin drifting; it is the addition not working. ⛔ `409 § 5.5`'s own comment
-- says the expected value is "a NAMED LIST, not a count" for precisely this reason.

do $$
declare
  v_missing_before integer;
  v_rows           integer;
  v_missing_after  integer;
  v_perms          integer;
begin
  select count(*) into v_missing_before
    from authz.permissions p
   where not exists (select 1 from authz.permission_implication_closure c
                      where c.implying = p.code and c.implied = p.code);
  if v_missing_before <> 18 then
    raise exception 'expected exactly 18 permissions with no reflexive closure edge (T4''s 18 new '
                    'codes); found % — the premise of this repair does not hold, so it is not '
                    'applied blind', v_missing_before;
  end if;

  -- ⛔ THE REBUILD IS TOTAL, NOT INCREMENTAL: the function DELETEs the closure and re-walks
  -- `authz.permissions` ∪ `authz.permission_implications`. That is the shape AE4.4 built, and
  -- inserting 18 reflexive rows by hand instead would leave the closure and its generator able to
  -- disagree — the drift a materialised view exists to prevent.
  v_rows := authz.rebuild_implication_closure();

  select count(*) into v_perms from authz.permissions;
  select count(*) into v_missing_after
    from authz.permissions p
   where not exists (select 1 from authz.permission_implication_closure c
                      where c.implying = p.code and c.implied = p.code);
  if v_missing_after <> 0 then
    raise exception 'after the rebuild % permission(s) still have no reflexive closure edge',
                    v_missing_after;
  end if;

  -- ⚠ `authz.permission_implications` is still EMPTY (AE4.4b never seeded an edge and AE5
  -- increment 1 adds none), so the closure is exactly the reflexive set and its row count must
  -- equal the permission count. ⛔ Asserted rather than assumed: the day a real implication edge
  -- is seeded this equality breaks, and it should — it is the signal that the closure has grown a
  -- structure this assertion was written before.
  if v_rows <> v_perms then
    raise exception 'the closure has % rows against % permissions. With '
                    'authz.permission_implications empty the closure is the reflexive set and the '
                    'two must be equal; a difference means an implication edge now exists and this '
                    'assertion needs re-ruling, not relaxing', v_rows, v_perms;
  end if;
end $$;
