-- ADR 0094 W4 / T4.9 — turn the Diretor Técnico on.
--
-- THIS IS THE LAST STEP OF W4, and it is a migration rather than a manual toggle for
-- one reason: a phase whose flag is flipped by hand ships DARK the moment it reaches an
-- environment nobody remembered to toggle. `db push` carries this file; a runbook step
-- does not.
--
-- Everything the flag gates is in place before this line:
--   * 20260905000400 — the two roles, their scope shape, the one-titular index, the
--     kernel arms and the atomic appointment door;
--   * 20260905000500 — the referral target sum type, the three audience arms, the
--     submission door with the same-hospital rule, and the PHI arm.
--
-- The flag is folded into app.is_technical_director_of_for rather than repeated at its
-- call sites, so this row is the single switch for the whole audience: flipping it back
-- to false empties the DT audience everywhere at once, including at any call site added
-- later. What it deliberately does NOT do is strand an appointment — the kernel's
-- REVOKE arm carries no flag check, so administrators can always remove a director the
-- feature no longer serves.
update app.feature_flags
   set enabled = true
 where key = 'technical_director';
