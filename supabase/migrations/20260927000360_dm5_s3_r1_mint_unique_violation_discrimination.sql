-- =============================================================================
-- DM5 S3 · r1 — QA MINOR-4: `mint_printed_document`'s `unique_violation` handler
--                could not attribute WHICH unique fired
--
-- The handler was `when unique_violation then raise … HC0D4` — "credential
-- collision — re-mint with fresh credentials". `printed_documents` carries SIX
-- unique constraints/indexes, and only two of them are credential collisions:
--
--   printed_documents_verification_token_key       ← HC0D4 is correct
--   printed_documents_verification_short_code_key  ← HC0D4 is correct
--   printed_documents_pkey                         ← a caller-supplied p_id clash
--   printed_documents_document_uniq                ← added by S3
--   printed_documents_document_version_uniq        ← added by S3
--   printed_documents_one_active                   ← the partial index
--
-- ⚠ THIS IS THE SAME CLASS AS AN UNTARGETED `ON CONFLICT DO NOTHING`: a broad
-- handler silently absorbs constraints it was never meant to speak for, and the
-- absorption grows every time someone adds a unique. S3 added two, which is what
-- made a latent shape worth fixing. The migration that added them said so in its
-- own header and then left the handler broad — recorded here because naming a
-- hazard is not the same as closing it.
--
-- ⛔ THIS FIX IS LATENT HARDENING, NOT A LIVE MISREPORT — and the first version of
-- this header claimed otherwise, which is why the correction is kept here rather
-- than quietly edited away.
--
-- The claim was: `p_id` is caller-supplied, so re-minting an existing id trips
-- `printed_documents_pkey`, used to be answered HC0D4, and the action would then
-- loop `MAX_MINT_ATTEMPTS` times on a fault it never diagnosed. **MEASURED, and
-- false.** A duplicate `p_id` derives the same coordinate, so it collides on
-- `file_objects_bucket_path_uniq` FIRST — which fires before the
-- `printed_documents` insert and therefore OUTSIDE this exception block:
--
--   MESSAGE: duplicate key value violates unique constraint
--            "file_objects_bucket_path_uniq"        sqlstate = 23505
--
-- So NO caller-reachable unique was ever misreported. Enumerated, the whole
-- non-credential set is unreachable at the handler today: `pkey` is shadowed by
-- the coordinate unique above; `document_uniq` / `document_version_uniq` take
-- freshly minted uuids; `one_active` is pre-empted by the supersession UPDATE
-- that runs first.
--
-- The fix is worth making anyway, for the reason the S3 satellite migration
-- already named and then did nothing about: the handler's domain is BROADER THAN
-- ITS MESSAGE, it silently grew by two when S3 added two uniques, and the next
-- unique someone adds could well be reachable. After this change the handler has
-- to be TAUGHT a new credential unique, and anything else keeps its own identity
-- — the direction that fails loudly.
--
-- ⚠ Because the arm is unreachable, keystoning it required OPENING THE LOCK THAT
-- HIDES IT: `342` S3n2 drops `file_objects_bucket_path_uniq` inside its
-- transaction so the same re-mint reaches the printed_documents insert and trips
-- `pkey`, where the handler can see it. S3n3 is the restore control. That is the
-- same "open each lock independently" prescription QA's MAJOR-1 applied to guard
-- 4 — and the first version of S3n2 was vacuous in precisely that way.
--
-- FIX: read `constraint_name` from the diagnostics and map ONLY the two
-- credential uniques to HC0D4. Everything else RE-RAISES with its own identity,
-- so a future unique cannot be absorbed by default — the handler now has to be
-- taught, which is the direction that fails loudly.
-- =============================================================================

begin;

do $mig$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  -- Surgical, from the LIVE catalog rather than by restating a 200-line body:
  -- reading the body we are editing out of `pg_get_functiondef` is the only way
  -- to be sure we edited the body that is actually installed (migration file
  -- text is stale by design in this repo).
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mint_printed_document';
  if v_def is null then
    raise exception 'DM5 S3 r1: mint_printed_document not found';
  end if;

  v_old := 'exception' || chr(10)
        || '    when unique_violation then';
  if position(v_old in v_def) = 0 then
    raise exception 'DM5 S3 r1: the unique_violation handler is not in the expected shape — refusing to patch blind';
  end if;

  v_new := 'exception' || chr(10)
        || '    when unique_violation then' || chr(10)
        || '      get stacked diagnostics v_constraint = constraint_name;' || chr(10)
        || '      if v_constraint not in (' || chr(10)
        || '           ''printed_documents_verification_token_key'',' || chr(10)
        || '           ''printed_documents_verification_short_code_key'') then' || chr(10)
        || '        raise;' || chr(10)
        || '      end if;';

  v_def := replace(v_def, v_old, v_new);

  -- The handler needs a local for the diagnostics read.
  v_def := replace(v_def,
    '  v_row public.printed_documents;',
    '  v_row public.printed_documents;' || chr(10) || '  v_constraint text;');

  execute v_def;
end $mig$;

-- -----------------------------------------------------------------------------
-- Verification, FROM THE CATALOG. Structural only — behaviour is 342 S3n's job,
-- because a migration cannot build a print (no tenancy exists at apply time; M1
-- learned that the hard way when its probe-based DO block passed `migration up`
-- and was falsified by a reset).
-- -----------------------------------------------------------------------------
do $$
declare
  v_src text;
begin
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mint_printed_document';

  if v_src !~ 'get stacked diagnostics v_constraint = constraint_name' then
    raise exception 'DM5 S3 r1: the handler does not read constraint_name';
  end if;
  -- The RE-RAISE is the load-bearing half: without it a new unique is absorbed
  -- as a credential collision by default.
  if v_src !~ 'raise;' then
    raise exception 'DM5 S3 r1: the handler does not re-raise a non-credential unique violation';
  end if;
  if v_src !~ 'printed_documents_verification_token_key'
     or v_src !~ 'printed_documents_verification_short_code_key' then
    raise exception 'DM5 S3 r1: the credential-unique allowlist is incomplete';
  end if;
  -- And HC0D4 must still be reachable for the credential case.
  if v_src !~ 'HC0D4' then
    raise exception 'DM5 S3 r1: HC0D4 is gone — the action''s re-mint path is now dead';
  end if;

  -- Every property a CREATE OR REPLACE can silently drop, re-asserted.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'mint_printed_document'
                    and p.prosecdef
                    and p.proconfig @> array['search_path=app, public, pg_catalog']) then
    raise exception 'DM5 S3 r1: mint_printed_document lost prosecdef or its search_path pin';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           aclexplode(p.proacl) x
       where n.nspname = 'public' and p.proname = 'mint_printed_document'
         and x.privilege_type = 'EXECUTE'
         and x.grantee in ('authenticated'::regrole, 'postgres'::regrole,
                           'service_role'::regrole)) <> 3 then
    raise exception 'DM5 S3 r1: mint_printed_document lost an EXECUTE grant';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                  aclexplode(p.proacl) x
              where n.nspname = 'public' and p.proname = 'mint_printed_document'
                and x.privilege_type = 'EXECUTE' and x.grantee = 0) then
    raise exception 'DM5 S3 r1: mint_printed_document gained a PUBLIC EXECUTE grant';
  end if;
end;
$$;

commit;
