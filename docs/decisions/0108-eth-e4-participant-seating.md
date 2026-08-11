# ADR 0108 — ETH·E4: seating case participants, and the doors the lane never got

- **Status:** Proposed (2026-08-11; revised same day after QA —
  [eth-e4-plan-review.md](../reviews/eth-e4-plan-review.md)) — closes FUP-ETH-1; PO decisions
  taken in interview 2026-08-11
- **Relates to:** ADR [0064](./0064-case-subject-generalization-participants.md) (participants
  substrate) · ADR [0072](./0072-ethics-access-spine.md) D6 (the write-authority contract) ·
  ADR [0073](./0073-ethics-procedure-model.md) (procedure) · ADR
  [0091](./0091-ff5-entity-reference.md) Decisions 1–3 (the surrogate ruling, the hybrid
  participant scoping, and invoker-rights search) · ADR
  [0093](./0093-phase-16-standards-crosswalk-replan.md) D4/D8 (the evidence enum that
  superseded E3b) · ADR [0079](./0079-authz-door-blindness-standing-invariant.md) (door sweep)

## Context

ETH·E3a shipped the primary-subject rail card, so an Ethics case renders "Médico denunciado".
Nothing fills it. Seating a respondent needs four rows, and **two of them have no writer**:

| Row | Door | |
| --- | ---- | - |
| `professional_profiles` | `create_professional_profile` | ✅ |
| `participants` (`participant_type='professional'`) | — | ❌ |
| `professional_participants` | — | ❌ |
| `case_participants` | `add_case_participant` | ✅ |

Verified against the **live catalog**, never migration text: exactly one function inserts into
`participants` (`set_participant_patient` — the patient lane), **zero** insert into
`professional_participants`, and all four tables are SELECT-only for `authenticated`, so there
is no direct-DML fallback. `add_case_participant` therefore demands a `participants.id` that no
door can mint for a professional. Above that, all 7 actions in
`src/lib/participants/actions.ts` are `notImplemented()` stubs with zero callers.

The tell that this is a substrate hole and not merely missing UI:
`e2e/ethics-e3a-surfacing.spec.ts` seats every respondent with raw
`dbInsert('case_participants', …)` at three sites. A spec that must bypass the product to reach
a shipped panel is the finding.

### Two premise corrections found while scoping (one re-corrected by QA)

1. **`set_primary_subject` EXISTS — shipped, keystoned, and set-only.** The first draft of
   this ADR claimed the function did not exist at all; QA re-verification against the live
   catalog (with the shared stack quiescent — the original scoping queries were truncated by a
   concurrent gate's DB resets) found `public.set_primary_subject(uuid)`: SECURITY DEFINER,
   `search_path` pinned, EXECUTE granted to `authenticated`, shipped in
   `20260720001010_ethics_participant_recusal_rpcs.sql` and gate-fixed in `20260722000000`
   (authz M1 §W-6). It is load-bearing: pgTAP suites **228** (t19 ACL keystones), **229**
   (M1·2 exclusion-gate keystone + a door census), and **314** (QO wall 11.3) all assert on
   it, and it is present in generated types. FUP-ETH-1's framing — an RPC awaiting its action
   caller — was the correct one.

   What the shipped body **cannot** do is what this track needs: it only *sets*
   `is_primary_subject = true` (a second primary raises `HC0E7` via the partial unique index —
   there is no way to **move** the primary once set), and it does **not** re-run
   `app.assert_respondent_linkage_resolved`, so a promotion path around `HC0F0` exists. The
   lane is therefore short **one new door** (the professional mint) plus **one behavior change
   to a shipped door** — not two new doors.

2. **E3b needs no build — Phase 16 already delivered it.** The E3 plan §5 sketched an
   accreditation evidence-link table as a future track gated on Phase 16. Phase 16 shipped
   `evidence_links` with `ethics_procedure` in its `artifact_kind` CHECK, ethics arms in
   `evidence_candidates` / `link_evidence` / `readiness_evidence`, the pt-BR label
   "Procedimento ético", and the D8 masking for restricted links. The evidence picker iterates
   the full label map, so the affordance is already reachable. The §5 sketch is superseded.

### The gap the roles table exposes (QA finding M-3)

The seeded `case_participant_roles` vocabulary already speaks for the whole proceeding:
`complainant` (Denunciante — {external_person, professional}), `witness` (Testemunha —
{external_person, professional}), `legal_representative` (Representante legal —
{external_person}), `external_regulatory_body` (Órgão regulador externo — {regulatory_body}).
A professional-only mint lane leaves **four of the seven seeded roles unfillable** — the same
"seeded role over an unfillable panel" shape FUP-ETH-1 was filed about, one lane over. Nearly
every processo ético starts with a denunciante; a roster that cannot record one is not adequate
for the committees this feature exists for. D8 closes this in the same track: the external lane
is a fraction of the professional lane's complexity (non-sensitive class, no profile table, no
linkage machinery).

## Decisions

1. **The mint door is separate, lives in `public`, and the seating door is not touched.**
   `public.ensure_professional_participant(p_profile_id) returns uuid` get-or-creates the
   `participants` + `professional_participants` pair and returns the registry id;
   `add_case_participant` then seats it, unchanged. **`public`, not `app`, is load-bearing:**
   `config.toml` exposes only `public` to PostgREST, so an `app.*` RPC is a 404 no client can
   reach — the "correct door nothing can reach" failure already on this project's record, and
   one the green pgTAP bar can never catch (pgTAP calls in-database; only E2E traverses
   PostgREST).

   Rejected: **folding the mint into `create_professional_profile`** — it rewrites a shipped
   DEFINER door (the ACL/`prosecdef`/`search_path` re-verification risk that
   "guards that read right but fail open" is about) and needs a backfill for existing profiles,
   which is the data-dependent-migration shape that passes a local reset with 0 rows and fails
   `db push` on the data-bearing remote. Rejected: **one atomic `seat_professional` door** — it
   would duplicate `add_case_participant`'s authorization, audit and `HC0F0` linkage logic,
   leaving two seating paths that must stay in sync forever.

   The registry identity is **1:1 with the profile and reused across cases**, which is what
   makes a doctor's prior-case history one record rather than several. Nothing enforces that
   today, so this ADR adds a **unique index on
   `professional_participants.professional_profile_id`** — the get-or-create depends on it.
   Two consequences of that index are decided here rather than left to implementation:
   - **The race arm is a targeted `on conflict (professional_profile_id)`** — never the
     untargeted form, which silently absorbs any future unique constraint. Because the
     `participants` row is inserted before the link row, the losing branch must delete its
     orphaned registry row and return the winner's id.
   - **The index is data-dependent on the remote.** The seed writes
     `professional_participants` directly, and service-role paths could have; before
     `db push`, the remote is checked read-only for duplicate `professional_profile_id` —
     the backfill-guard-wrap failure shape (passes a 0-row local reset, fails 23514 on push).

2. **`set_primary_subject` is MODIFIED, not created** — a `create or replace` over the shipped
   door, with exactly two deltas and everything else byte-identical:
   - **Move semantics:** demote the case's current primary (`is_primary_subject = false`),
     then promote the target — two sequential statements inside the function's transaction, so
     the partial unique index behind `HC0E7` is never transiently violated (the demote clears
     the index entry before the promote adds one; a single dual-row UPDATE has no guaranteed
     row order and could trip the index mid-statement). The existing `unique_violation` →
     `HC0E7` arm stays as a backstop.
   - **Linkage re-run:** `perform app.assert_respondent_linkage_resolved(participant, role)`
     for the target row — a promotion to primary subject must not become a way around `HC0F0`
     (a profile can be flipped back to `unknown` by `set_professional_link_state` after
     seating).

   The gates (`HC0E4` / `HC0F1`), the audit event (**`case.primary_subject_set`** — the
   shipped name, kept), and the ACL are untouched; because this is a shipped DEFINER door, the
   change is applied with **`create or replace`, never DROP+CREATE**, and `prosecdef`,
   `proconfig` and the ACL are diffed from the catalog property-by-property afterwards. The
   three existing keystone suites (228 / 229 / 314) assert the ACL, the exclusion gate, and
   the tenancy wall — none pins set-only semantics — and **must stay green**; any door census
   they carry is updated consciously, never loosened.

3. **`participants.display_name` for a professional is the real name**, set from
   `professional_profiles.full_name` at mint. This is not a relaxation of the surrogate rule:
   ADR 0091 Decision 1 already holds that the column is "a surrogate for patients and an
   already-org-readable name for professionals", and the
   `participants_sensitivity_derives_type` CHECK forces `sensitivity_class =
   'professional_identity'` for the type. The disambiguator is **not** baked into this column —
   see D5. The column is a **mint-time snapshot**: `update_professional_profile` can change
   `full_name` later and this ADR deliberately does not add a sync (that would modify a second
   shipped door for a cosmetic property). Instead the roster **renders the live profile name
   when the caller can read the profile, falling back to `display_name`** — so managers and
   case readers always see the current name, and the snapshot only ever surfaces to callers
   who could not read the profile anyway.

4. **Candidate search is invoker-rights, never a DEFINER door.** The picker reads `participants`
   through `participants_select` (`is_org_member(organization_id)`), inheriting ADR 0091
   Decision 2's org-scoping for every non-patient type and Decision 3's ruling that a DEFINER
   search would *replace* RLS and re-derive a perimeter by hand for no capability. The same
   query serves both lanes (professional and external), filtered by `participant_type`.

5. **`app.can_read_professional_profile` gains one org-manager disjunct:**
   `or app.can_manage_professional(organization_id, p_uid)`.

   Without it the picker is unusable in the one place accuracy matters. The gate today resolves
   true only for a platform admin or for a professional **already seated on a case the caller
   can read** — so an unseated professional shows as a bare name, and two "João Silva" are
   indistinguishable at the moment a coordinator seats a respondent on a disciplinary case.

   **The exposure argument, stated so it can be checked:** `participants_select` is already
   `is_org_member(organization_id)`, so every professional's **name and existence in the
   registry are org-readable by design**. This arm adds `license_number` / `specialty` /
   `professional_type` to people who may already seat professionals — it does **not** add the
   existence fact, and it discloses no case linkage (`professional_participants` carries no
   `case_id`). It is a widening nonetheless, and is keystoned as one: the pgTAP proof must be
   shown able to fail by reverting the arm and requiring RED, because a no-regression test
   passes a widening by construction.

   Two adjacent exposures are named here so they are accepted deliberately, not by omission:
   - **The mint-time inference (new with E4).** A professional's registry row is created only
     at seating time, so post-E4 mere presence in the org-readable `participants` table
     implies *"was involved in at least one case"* — with role, case, and count invisible.
     Accepted: the inference discloses no proceeding, no role (the person may be a relator or
     witness, not a respondent), and no direction; the alternatives (tightening
     `participants_select` for the professional type, or pre-minting the whole org roster to
     make existence uninformative) each cost more than the inference reveals. If the PO's
     read of sigilo tightens, `participants_select` is the single seam to revisit.
   - **The caller/target asymmetry.** `can_manage_professional`'s `is_org_admin_of` disjunct
     reads the **caller's** `auth.uid()`, not `p_uid` (recorded in its header comment, left
     deliberately by the ACT expiry work). Both policies backing this predicate bind
     `p_uid = auth.uid()`, so caller and target coincide today — but D5 propagates the
     asymmetry into a second predicate; any future call site passing a non-caller `p_uid`
     must not inherit it silently.

   The change is applied with **`create or replace`, never DROP+CREATE**, and `prosecdef`,
   `proconfig` and the ACL are diffed from the catalog property-by-property afterwards.

6. **Platform-account linkage is resolved up front, with no default.** The "cadastrar
   profissional" form requires the choice: *possui conta* (pick the platform user via the
   existing org roster) or *não possui conta* behind an explicit confirmation that names the
   consequence — that the automatic case exclusion becomes vacuously satisfied. `no_account`
   is an audited human assertion and must never be reachable by accepting a default. Seating
   an existing `unknown` profile prompts inline before submit, so `HC0F0` is never reached in
   normal use; a "resolver vínculo" affordance on the roster row covers profiles already
   sitting at `unknown`, without which item ④ of FUP-ETH-1 stays a dead end.

7. **The roster is a main-column surface; the shipped rail card is not rewritten.**
   `CasePrimarySubjectPanel` stays exactly as-is as the at-a-glance summary — E3a's E2E
   locators assert its heading and empty state — and a new
   `CaseParticipantsPanel` carries the roster (add / remove / set-role / set-primary). For an
   ethics case the roster is substantive content, not the "reference material" the rail is
   documented to hold. All professional identity management (create, correct, resolve linkage)
   lives in the roster's dialogs rather than a separate org directory screen.

8. **The external lane ships in this track:
   `public.create_external_participant(p_org, p_type, p_display_name) returns uuid`.**
   It mints a `participants` row with `sensitivity_class = 'non_sensitive'`,
   `p_type` constrained to the five non-sensitive types (`external_person`, `department`,
   `institution`, `regulatory_body`, `other` — the derives-type CHECK backstops this), gated
   by the same `app.can_manage_professional(p_org, auth.uid())` capability (the predicate
   names the population — org admins + staff_admins — not the professional class), audited,
   same `public`-schema / revoke-then-grant door pattern as D1.

   Unlike the professional lane this is **create-always, not get-or-create**: an external
   person has no natural key, and deduplicating by display name would silently merge distinct
   same-named people — the worse failure. Reuse is by human choice instead: the add dialog
   searches existing external participants (org-scoped via `participants_select`, D4) before
   offering to create. Duplicate rows are an accepted cost; a merge affordance, if ever
   needed, is its own track.

   Rejected: **deferring the lane to a follow-up** — it leaves Denunciante, Testemunha,
   Representante legal and Órgão regulador externo as seeded-but-dead vocabulary, repeats the
   FUP-ETH-1 shape knowingly, and would reopen the FUP-FF5-2 writer-census keystone one track
   later for a door this small.

## Consequences

- The `participants` writer set becomes **exactly three** functions — the patient lane, the
  professional lane, and the external lane. This resolves **FUP-FF5-2**, which asks for an
  assertion pinning that set by count *and* name: ADR 0091's prose claimed "exactly two" while
  the catalog answered one. The assertion is written from the catalog, and lands in this
  track's pgTAP.
- All seven seeded participant roles become fillable through the product; the denunciante of a
  sindicância is recordable from day one.
- `e2e/ethics-e3a-surfacing.spec.ts`'s three raw `dbInsert` sites are replaced with the real
  product path; that replacement is the evidence the panel is reachable.
- The seating flow cannot dead-end on authorization: `add_case_participant` requires
  `is_staff_admin_of(commission)`, which implies `can_manage_professional(org, …)` (whose
  disjuncts include staff_admin of any commission in the org), so anyone who may seat may mint
  — in either lane.
- **Two new DEFINER gates** (the two mint doors), **one modified shipped gate**
  (`set_primary_subject`), and **one widened RLS predicate** — so **`ARM=census` is the
  load-bearing authz gate for the new doors** (a brand-new gate is in no BLIND set, so
  `ARM=policy` passes vacuously — ADR 0079 Amendment 3), while the modified door and the
  widened predicate are exactly what the **diff-scoped door sweep** exists for; it runs over
  all four.
- `create_professional_profile` gains its first caller since it shipped.
- **Not decided here:** whether professional identity eventually deserves its own org-level
  directory screen (D7 keeps it in the roster; a second consumer makes it its own track), and
  whether duplicate external participants ever warrant a merge tool (D8 accepts them).
