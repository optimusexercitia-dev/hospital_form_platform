# DEFINER-SEARCH-PATH-NARROW-FIX — progress record

> Hub: [definer-search-path-narrow-fix.md](../features/definer-search-path-narrow-fix.md) ·
> branch `definer-search-path-narrow-fix`, cut from `main @ 6d7dd589` · owed by ADR 0208 D5 + D6 ·
> closes `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`.

## Session log

### 2026-09-11 — unit opened; the ordering ruled; the subject measured from the catalog (lead)

**Why this unit runs before `AE5-ROLE-CATALOG-COMPAT`** (PO ruling on the lead's recommendation,
recorded durably beside ADR 0207's `assume_role` consequence, and mirrored in the pre-AE5 handoff):
the compat unit's step 2 writes a NEW SECURITY DEFINER, which ADR 0208 D4 binds to
`search_path = ''`; nothing enforces that until the 419 ratchet exists. Merging the two units was
refused — different subjects, different close conditions, and the FUP's own ⛔ *"converging one door
is not closing the class"*.

**Measured live 2026-09-11** (`pg_proc`, local stack `supabase_db_azkbbhskturikxpgmafq`):

| function | `prosecdef` | `proconfig` |
| --- | --- | --- |
| `app.can_read_professional_profile(uuid,uuid)` | t | `search_path=app, public, pg_catalog` |
| `public.assume_role(platform_role)` | t | `search_path=app, public, pg_catalog` |
| `app.tenant_orphan_profiles()` | t | `search_path=app, public, pg_catalog` |
| `public.tenant_orphan_profiles()` | t | `search_path=public, app, pg_catalog` |

Non-empty-path `prosecdef` population in `app`/`public`/`authz`: **867** (= 890 − 23 empty-form,
reproducing the FUP's five-value table). Next free pgTAP number **419** confirmed free (418 is the
tail). `413:186-199` pins BOTH `app.current_professional_read_organizations` and
`app.can_read_professional_profile` on the three-schema string by name; only the second moves here.

**Coverage of the four temp-table DEFINERs before this unit** (Explore, file:line in the agent's
report, summarized): `copy_version_children` — pgTAP 271/274/277 + E2E purge helper;
`clone_framework` — pgTAP 280 + E2E phase16 spec; `copy_response_answers` — ONE mutation note in 276,
no direct call; ⭐ `copy_template_version_children` — **zero** pgTAP, zero TS/E2E. That last one is
the gap in D6's "tested first" precondition and needs a fixture.

`.claude/rules/` holds no file naming `search_path` or `SECURITY DEFINER` (12 files grepped) — the
D5 hint does not exist yet.

Doc gates after the two ruling edits: `lint:progress` rc 0 · `lint:registers` rc 0 ·
`lint:adr-index` rc 0 (next free ADR **0210**) · `lint:mojibake` rc 0.
