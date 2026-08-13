-- AFF W1 / T1.4 — `professional_profiles.cpf`.
--
-- ADR 0097 D15: the COLUMN lands now because it is free during the reset window; the
-- LINKING BEHAVIOUR is DEFERRED and will only ever run from inside a case.
--
-- ⚠ Deliberately NOT here, and not to be "completed" by a later reader:
--   * no matching, no lookup, no writer — a registration-side match would disclose to
--     a hospital admin with no case access that a doctor is or was the subject of an
--     ethics review (ADR 0097 finding 7), a worse leak than the one AFF fixes;
--   * `link_state` is untouched, and so are the unbuilt `participants` /
--     `professional_participants` writers (FUP-ETH-1);
--   * **no unique index.** `profiles.cpf` is unique platform-wide because it is the
--     PERSON key; `professional_profiles` rows are org-scoped case-subject records
--     whose only writer today is `create_professional_profile`, and a uniqueness rule
--     over them is a linking decision D15 defers. Adding one later is additive.
--
-- Same digits-only + check-digit treatment as `profiles.cpf`, through the SAME
-- authority (`app.is_valid_cpf`, 20260909000200) — one function, two call sites.
--
-- Read audience, recorded because it differs from `profiles` and was checked rather
-- than assumed: `professional_profiles` has ONE policy, `professional_profiles_select`
-- (`app.can_read_professional_profile(id, auth.uid())` → `professional_participants` →
-- `case_participants` → `can_read_case`). There is no co-member leg, so the HIGH-1
-- column-lock argument that governs `profiles` does not transfer: the audience is
-- people with case access to a case this professional participates in, which is the
-- same audience that already reads `full_name` and `license_number` on the same row.

alter table public.professional_profiles add column cpf text;

alter table public.professional_profiles
  add constraint professional_profiles_cpf_valid
  check (cpf is null or app.is_valid_cpf(cpf));

comment on column public.professional_profiles.cpf is
  'Person identifier for the case-subject record (ADR 0097 D15). Digits-only, check-digit validated by app.is_valid_cpf. COLUMN ONLY — no matching, no linking, no uniqueness: linking is deferred to FUP-ETH-1 and only ever runs from inside a case.';
