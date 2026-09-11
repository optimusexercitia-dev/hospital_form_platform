-- The DEFINER search_path DOMAIN, defined ONCE.
--
-- ⭐ WHY THIS FILE EXISTS AT ALL. Two consumers need "the prosecdef population of
-- app/public/authz, split by whether its declared search_path is the empty form":
--
--   scripts/gen-definer-search-path-freeze.mjs   -- freezes the NON-EMPTY half (--write)
--   supabase/tests/419_definer_search_path_freeze.sql  -- ratchets the live half against it
--
-- Written twice, the two would drift, and the drift would be SILENT IN THE SAFE
-- DIRECTION: a freeze whose domain quietly narrowed still matches a gate whose domain
-- narrowed the same way, and a new DEFINER outside both is invisible to each. So the
-- block below is extracted BY TEXT into the generator and spliced BY TEXT into 419, and
-- `node scripts/gen-definer-search-path-freeze.mjs --check` (gate 18) compares the two
-- copies byte-for-byte. Precedent: scripts/data-access-census.sql + gate 17's check D.
--
-- ⛔ EDIT THE BLOCK, NEVER ITS COPIES. 419 carries the same text between the same
-- markers; changing one and not the other REDS gate 18, which is the point.
--
-- ⚠ THE EMPTY FORM IS THE TWO-CHARACTER STRING `""`, NOT THE EMPTY STRING. `set
-- search_path to ''` stores as the proconfig element `search_path=""`, so `substring(c
-- from 13)` yields `""` — a literal pair of quote characters. A predicate written
-- `sp <> ''` would classify every empty-form function as NON-empty and freeze all 890.
-- Measured 2026-09-11 on this catalog: 890 total, 0 undeclared, 23 empty, 867 non-empty.
--
-- ⛔ WHAT THE DOMAIN DELIBERATELY EXCLUDES, so a green is not over-read: a DEFINER
-- carrying NO `search_path` at all (`sp is null`) is `sp_nonempty = false` here and
-- therefore never enters the frozen set. That population is pinned at 0 by
-- `414_definer_search_path_resolves.sql § 0b` (890 of 890 declare one) and its
-- disposition is the follow-up's open half 1 — it is NOT covered by the freeze, and
-- admitting it would make the ratchet's subset arm ambiguous about which half moved.

-- >>> BEGIN definer_nonempty_domain <<<
select n.nspname as schema_name,
       n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
       (select substring(c from 13) from unnest(p.proconfig) c
         where c like 'search\_path=%' limit 1) as sp,
       coalesce((select substring(c from 13) from unnest(p.proconfig) c
                  where c like 'search\_path=%' limit 1), '""') <> '""' as sp_nonempty
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('app', 'public', 'authz')
   and p.prosecdef
-- >>> END definer_nonempty_domain <<<
;
