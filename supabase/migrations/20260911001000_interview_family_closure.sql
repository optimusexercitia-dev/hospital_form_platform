-- =============================================================================
-- QO·A M11 — close the interview family by OWNERSHIP, not by helper name
-- (QA r2 R1, BLOCKER).
--
-- ⛔ WHAT WENT WRONG, stated plainly because it is the phase's recurring defect
-- and this is its THIRD instance. M10 §B2 said "7 tables route
-- `can_read_interview`". That sentence was ACCURATE and it was the bug: it
-- defined the family as *things that call a particular helper* when the family
-- is *things OWNED BY an interview*. Two members reach the same data through
-- RAW `can_read_case` and were therefore never in scope:
--
--   * `case_interview_links_select` — qual is
--     `app.can_read_case(app.case_of_interview(interview_id), auth.uid())`.
--     Reviewer-reachable on the seed: the row is titled "Gravação de áudio
--     (link externo)" and carries `external_url`, which is column-granted to
--     `authenticated`. NOT a storage object, so M8/M9's bytes cut never
--     governed it — the reviewer learns an interview exists, its title, and
--     WHERE ITS AUDIO LIVES, while the platform has just declared interviews
--     invisible to them.
--   * `app.can_read_attachment`'s `'interview'` arm — also raw `can_read_case`,
--     so interview-owned attachment METADATA (e.g. "Transcrição assinada
--     (rascunho)") stayed readable.
--
-- ⚠ AND THE GUARD COULD NOT CATCH IT: `311` §5.1 counted a HARDCODED table list
-- against a literal. A count against a literal is not an invariant over a
-- family — a member that was never in the list can never red it. That is fixed
-- in the same wave: §5.1 becomes a DERIVATION over the catalog, so a ninth
-- table appearing tomorrow reds on its own.
--
-- (M10 documented catching this identical shape for `action_items_select`,
-- which routes `can_read_case` directly — one section before repeating it. An
-- enumeration whose boundary is a NAME is not a closure. The standing rule in
-- ADR 0100 now carries this instance too.)
--
-- THE CUT: the same committee-plane predicate M10 used, applied to both
-- remaining members. `app.can_read_case_committee` = `can_read_case` as it
-- meant BEFORE S7, so LOST = 0 for every pre-existing reader (the lattice
-- invariant — now itself keystoned, QA r2 R2).
--
-- ⚠ The `'case'` arm of `can_read_attachment` is deliberately UNTOUCHED: the
-- lead ruled case-attachment METADATA stays reviewer-visible (the documents
-- panel renders names; the BYTES are cut by M8/M9). Interviews are different —
-- the platform declares them invisible, so their metadata goes too.
-- =============================================================================

-- ── A · case_interview_links_select ─────────────────────────────────────────
do $$
declare v_qual text; v_new text;
begin
  select qual into v_qual from pg_policies
  where schemaname = 'public' and tablename = 'case_interview_links'
    and policyname = 'case_interview_links_select';
  if v_qual is null then
    raise exception 'M11: case_interview_links_select not found';
  end if;
  v_new := replace(v_qual, 'app.can_read_case(', 'app.can_read_case_committee(');
  if v_new = v_qual then
    raise exception 'M11: case_interview_links_select does not route a bare can_read_case — text drifted, re-read the catalog (qual: %)', v_qual;
  end if;
  execute format('alter policy case_interview_links_select on public.case_interview_links using (%s)', v_new);
end $$;

-- ── B · app.can_read_attachment, the 'interview' arm ONLY ───────────────────
do $$
declare v_old text; v_new text; v_needle text; v_repl text;
begin
  v_old := pg_get_functiondef('app.can_read_attachment(text,uuid,uuid)'::regprocedure);
  v_needle := 'app.can_read_case(app.case_of_interview(p_owner_id), p_uid)';
  v_repl   := 'app.can_read_case_committee(app.case_of_interview(p_owner_id), p_uid)';
  v_new := replace(v_old, v_needle, v_repl);
  if v_new = v_old then
    raise exception 'M11: the interview arm of can_read_attachment did not match — re-read the catalog';
  end if;
  -- single-replacement proof (the M5/M10 discipline): exactly one site moved,
  -- so the 'case' arm cannot have been caught by the same replace.
  if length(v_new) - length(v_old) <> length(v_repl) - length(v_needle) then
    raise exception 'M11: more than one replacement landed in can_read_attachment';
  end if;
  execute v_new;
end $$;

-- ── C · THE DELIBERATE NON-CUT (PO ruling 2026-08-07) ───────────────────────
-- `case_conflict_declarations_select` and `case_recusals_select` stay on the
-- WIDENED `can_read_case` — the reviewer MAY read other members' conflict and
-- recusal records. This asymmetry with the D7 write ruling is deliberate and
-- will look like an oversight to the next reader, so it is recorded in the
-- CATALOG (comment on policy), not only in a migration file:
--
--   * these are GOVERNANCE METADATA, not deliberation content — who stepped
--     back from a case and why. Reviewing whether conflicts were properly
--     declared and handled is close to the core of what a quality office does,
--     and D3 confers full case-content read.
--   * the WRITE ruling turned on a DIFFERENT fact: a record AUTHORED BY a
--     principal who is excluded from deliberation and neither votes nor decides
--     has no consumer in the model. Reading other members' records has an
--     obvious consumer — the oversight review itself.
--
-- ⚠ HOW THIS RULING IS PINNED, stated precisely (QA r3): TWO ways, not three.
--   1. the two catalog comments below - durable and visible in pg_policies to
--      anyone inspecting the arms, but a comment CANNOT FAIL; and
--   2. pgTAP 311 section 5.2c - the SINGLE FAILING PIN, which reds if either
--      policy is ever moved onto the committee plane.
-- This migration block deliberately does NOT add a postcondition for the
-- ruling: a migration postcondition runs ONCE at apply time and cannot guard a
-- later change, so it would read as a third guard while protecting nothing.
--
-- Shape, stated once: the reviewer MAY SEE that a member recused, and MAY NOT
-- CREATE such a record themselves. Acknowledged consequence: this does reveal
-- that a NAMED member declared a conflict on a case.
comment on policy case_conflict_declarations_select on public.case_conflict_declarations is
  'ADR 0100 (PO ruling 2026-08-07): deliberately stays on the widened can_read_case — a '
  'quality_reviewer MAY READ conflict declarations (governance metadata, and reviewing how '
  'conflicts were handled is core oversight work) while D7 forbids them AUTHORING one. Do not '
  '"fix" the asymmetry with the write doors; it is the ruling.';
comment on policy case_recusals_select on public.case_recusals is
  'ADR 0100 (PO ruling 2026-08-07): deliberately stays on the widened can_read_case — a '
  'quality_reviewer MAY READ recusal records (who stepped back and why) while D7 forbids them '
  'RECORDING one. Acknowledged consequence: reveals that a named member recused on a case.';

-- ── Postconditions ──────────────────────────────────────────────────────────
do $$
declare v_leaky text;
begin
  -- DERIVED, not listed: no policy that reaches an interview anchor may still
  -- route the WIDENED can_read_case. (`can_read_case(` cannot match
  -- `can_read_case_committee(` — the paren placement differs.)
  select coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename), '')
    into v_leaky
  from pg_policies
  where schemaname = 'public'
    and qual ~ 'case_of_interview\('
    and qual ~ 'app\.can_read_case\(';
  if v_leaky <> '' then
    raise exception 'M11 postcondition: interview-anchored policies still on the widened predicate: %', v_leaky;
  end if;

  -- the attachment dispatcher's interview arm is cut, and its 'case' arm is NOT
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'can_read_attachment')
     !~ 'can_read_case_committee\(app\.case_of_interview' then
    raise exception 'M11 postcondition: the interview arm of can_read_attachment is not cut';
  end if;
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'can_read_attachment')
     !~ 'when ''case'' then\s+app\.can_read_case\(' then
    raise exception 'M11 postcondition: the case arm of can_read_attachment was changed (metadata must stay visible — lead ruling)';
  end if;
end $$;
