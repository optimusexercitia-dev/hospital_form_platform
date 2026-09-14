#!/usr/bin/env python
# AE4.5 differential-oracle cell generator.
#
#   python3 scripts/gen-authz-differential-cells.py            # regenerate the .psql
#   python3 scripts/gen-authz-differential-cells.py --check    # verify, exit 1 on drift (gate 12)
#   python3 scripts/gen-authz-differential-cells.py --self-test # prove every coverage arm fires
#
# ⛔ THE AXES COME FROM THE JSON, NOT FROM THIS FILE. An earlier revision hard-coded every axis
# list here while sha-stamping a JSON it never read, so `principalState: offboarded` — a value the
# axes file explicitly RULES an "ORDINARY FILLABLE COORDINATE" — and `scope: zero_scope` were both
# dropped with no rule, no counter and no arm able to notice (QA 2026-09-01, F4). Values are now
# read from the file, and any value this generator does not emit must be named in EXCLUSIONS with
# a reason. arm7 is what enforces that, and arm7 itself is exercised by --self-test.

import io, os, json, sys, hashlib, textwrap

# ⛔ EVERY DIAGNOSTIC THIS FILE PRINTS CONTAINS NON-ASCII, AND THE GATE PIPE IS cp1252 ON WINDOWS.
# Without this, --check's DRIFT message died with a UnicodeEncodeError traceback — exit code still
# 1, so the gate failed correctly, but the operator saw "the generator is broken" instead of "the
# oracle's expected values drifted", which points the fix at the wrong file. It surfaced only
# under test because the SUCCESS message is pure ASCII: the positive control could not reach the
# failing state.
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace('\\', '/')
SRC = ROOT + '/supabase/tests/vectors/authz-matrix-axes.json'
OUT = ROOT + '/supabase/tests/vectors/authz_differential_cells.psql'

raw = io.open(SRC, 'rb').read()
sha = hashlib.sha256(raw).hexdigest()
spec = json.loads(raw.decode('utf-8'))

# ⭐ A SECOND INPUT, READ BUT NEVER WRITTEN, AND IT IS AN AUTHORITY RATHER THAN A CONVENIENCE.
# The gate-scoped `caseReach` skip rule below rests on ONE claim — exactly one representative's
# gate carries a case arm. That claim is not this file's to make: it is stated in the enforcement
# manifest as `permissions[<code>].legacyEquivalence.openArms`. arm9 reads it on EVERY run and
# refuses to emit when the manifest and the skip rule's premise disagree, which is what turns
# "revisit this if another permission gains the case arm" from a hope into a gate.
# ⛔ NOT sha-stamped into the output on purpose: the manifest does not change a single generated
# byte. Stamping it would make an unrelated manifest edit look like oracle drift in --check, which
# is the one signal in this file that must stay unambiguous. arm9 is the detector, not the sha.
MANIFEST_SRC = ROOT + '/supabase/tests/vectors/authz-enforcement-manifest.json'
_MANIFEST_ERR = None
try:
    _MANIFEST_ROOT = json.loads(io.open(MANIFEST_SRC, 'rb').read().decode('utf-8'))
    MANIFEST_PERMISSIONS = _MANIFEST_ROOT['permissions']
except Exception as _e:                       # noqa: BLE001 — any failure here is arm9's business
    MANIFEST_PERMISSIONS, _MANIFEST_ERR = None, '%s: %s' % (type(_e).__name__, _e)
    _MANIFEST_ROOT = {}

# ── The legacy-equivalence classes swept here, asserted in pgTAP 401 §19.2 ─────────────────
REPS = [
    # code, legacy class, resolution scope
    ('commission.forms.edit',      'is_staff_admin_of_for',        'commission'),
    # ⭐ AE4.7c RE-POINTED THIS REP, and the reason is a coverage loss no arm names.
    # `staff_admin` LOST org.professionals.manage (matrix § 12.8.5 — it may ADD a professional,
    # never MODIFY one). A rep the subject role does not hold makes EVERY cell of its class a
    # denial: the class stops exercising the granted polarity at all, and arm2 does not catch it
    # because arm2 is satisfied GLOBALLY by the other two reps. org.professionals.create is the
    # code staff_admin does hold, on the same gate family and the same org resolution scope.
    ('org.professionals.create',   'can_create_professional',      'organization'),
    ('org.professionals.read',     'can_read_professional_profile','organization'),
    # ⭐⭐ A FOURTH REP, ADDED AT AE4.9 TO REPAIR COVERAGE THE RE-KEY REMOVED (lead ruling
    # 2026-09-02, option (b) on the 401 § 19.2b red). NOT a widening for its own sake.
    #
    # WHAT BROKE. 401 § 19.2b licensed running THREE reps for SIX legacy-equivalence classes on
    # a measured fact: rows 31, 32 and 43 were gated by three DIFFERENTLY NAMED functions whose
    # comment-stripped bodies were IDENTICAL, so org.professionals.create spoke for all three.
    # The AE4.9 D6 re-key gave row 43's gate a permission arm and SPLIT that body — measured
    # `count(distinct prosrc)` over the three went 1 -> 2. Rows 31 and 32 lost their
    # representative, silently, and no arm in any suite said so.
    #
    # ⛔ THE FIX IS A TEST FIX, NOT A RE-KEY. Re-keying rows 31/32 would widen the build past
    # the PO-confirmed Gate AE4 scope (ADR 0176 D6, exactly three permissions). The gap is in
    # COVERAGE, not in enforcement, so it is closed here.
    #
    # WHY org.case_vocabulary.manage AND NOT org.participants.external.manage — they are
    # interchangeable on every axis that matters (identical bodies, identical (p_org, p_uid)
    # signatures, same organization resolution scope, both held by staff_admin, and NEITHER
    # needs a resource row the way row 33's profile-keyed gate does). The tie-break is a
    # catalog property: `resource_kind`. The other three reps cover `commission_content` and
    # `identity` twice over; org.case_vocabulary.manage is the only `vocabulary` permission
    # among the candidates, so choosing it adds a resource_kind the sweep otherwise never sees.
    # ⚠ 403 § 2.3b asserted rows 31 and 32 STILL share one body — that co-sharing was the entire
    # basis for one rep covering both, and if a later change split THEM it was what caught it.
    # ⭐ IT DID CATCH IT, ON 2026-09-10 — see the FIFTH rep immediately below.
    ('org.case_vocabulary.manage',  'can_manage_case_vocabulary',   'organization'),
    # ⭐⭐ A FIFTH REP, ADDED AT pre-AE5 BATCH 10 (PO ruling R4, 2026-09-10), FOR THE SECOND
    # OCCURRENCE OF EXACTLY THE FAILURE THE FOURTH REP REPAIRED. The two occurrences are worth
    # reading together, because the mechanism is identical and the trigger is not.
    #
    # WHAT BROKE, MEASURED. ADR 0201 D5 (pre-AE5 Batch 10) relocates the platform arm: it is
    # REMOVED from app.can_manage_professional and added EXPLICITLY to app.can_manage_case_vocabulary
    # — and to that gate ONLY, because A35's noun list makes case vocabulary a MAY-noun while a
    # tenant's professional registry is not. `can_manage_external_participant` did not get it, ON
    # PURPOSE: D5's declared loss list includes external-participant minting, pinned RED-first by
    # pgTAP 418 § 4.7. So the two bodies that 403 § 2.3b asserted were IDENTICAL diverged, exactly
    # as that assertion said they one day would, and rows 31/32's single shared rep stopped
    # speaking for row 31. Measured at head (20261003007390, 528): `count(distinct` comment-stripped
    # `prosrc)` over the three org gates went 2 -> 3, and over the 31/32 pair 1 -> 2.
    #
    # ⛔ THE FIX IS A TEST FIX AGAIN, AND FOR A STRONGER REASON THAN LAST TIME. The alternative —
    # arming can_manage_external_participant with the same relocated arm to restore body identity —
    # was PUT TO THE PO AND REJECTED: it contradicts ADR 0201 D5 and would let a platform_admin mint
    # `public.participants` rows in any tenant's organization. The gap is in COVERAGE, not in
    # enforcement, so it is closed here.
    #
    # ⭐ WHAT CHANGES BEYOND ONE LINE: the body-identity REDUCTION IS RETIRED for these three org
    # gates. Each of them now has a representative of its own, so no cell's coverage rides on two
    # functions continuing to agree. 401 § 19.2c is re-ruled to name that map (gate -> rep) rather
    # than to name a surviving pair, and 403 § 2.3b is re-ruled onto the rep's EXISTENCE AND
    # POLARITY rather than onto the identity that is gone.
    #
    # ⚠ THE TIE-BREAK THAT PICKED THE FOURTH REP DOES NOT APPLY HERE and is not being re-used:
    # `resource_kind` for org.participants.external.manage is `identity`, which the sweep already
    # sees twice. This rep is not chosen among candidates — the ruling is that ROW 31 ITSELF needs
    # one, so the code is determined, not selected.
    ('org.participants.external.manage', 'can_manage_external_participant', 'organization'),
]

# ── AE5 INCREMENT 1: `staff`'s REPRESENTATIVES ───────────────────────────────────────────────
# ⛔ EVERY REP IS A CODE `staff` HOLDS (matrix § 5.2, PO-approved 2026-09-13). That is the AE4.7c
# lesson applied rather than re-learned: a rep the subject does NOT hold makes every cell of its
# class a denial, and arm2 does not catch it because arm2 is satisfied globally by the other reps.
#
# ⭐ THE SELECTION RULE IS THE `memberGateArm` PROFILE, NOT THE DOOR NAME, and the reason is that
# `staff` has only ONE legacy-equivalence gate. Every one of its 40 policies and 42 function
# bodies resolves to `app.is_member_of_for` -> `app.has_role_any('commission', ...)`; the
# per-door differences live in the NON-PERMISSION TERMS the matrix § 5.3 criterion enumerated,
# which is exactly what the `memberGateArm` axis coordinates. So the reps are chosen to cover
# every declared value of that axis at least once, plus both risk classes:
#   none                             -> commission.process_templates.read   (9 policies, no extra term)
#   none, write polarity             -> commission.responses.create         (the ONE membership-gated write)
#   conjunct_met / conjunct_unmet    -> commission.meetings.read            (visibility_policy / attendee)
#   disjunct_present / _absent       -> commission.accreditation.read       (the PUBLIC NULL-owner arm)
#   BOTH limbs on one row            -> commission.action_items.read        (visibility_scope + assignee)
# ⛔ THE VALUE SET PER REP IS NOT WRITTEN HERE — it is read from the enforcement manifest at
# `permissions[<code>].memberGateArm`, and arm11 refuses to emit if this list and the manifest
# disagree. A generator's claim about its own coverage is not a detector (the arm9 lesson, one
# axis over).
REPS_STAFF = [
    # ⭐⭐ LEAD RULING L2 (2026-09-13) REPLACED THIS LIST. The previous five reps were keyed on
    # `is_member_of_for` — the bare membership predicate — and the eleven-term axis was moved OUT of
    # this generator because that predicate reads none of the terms. ⛔ THE WRONG HALF MOVED: ADR
    # 0175 D3's shape is that an arm-3 row's LEGACY COLUMN CALLS THE REAL DOOR ("403 calls the real
    # door now"). With the door as the legacy side the axis IS consumed, so the sweep belongs here
    # and the reps are the eleven carrying rows themselves.
    #
    # ⛔ THE CLASS IS THE DOOR, NOT `is_member_of_for`, and that is the whole correction. Each entry
    # is (code, legacy class, resolution scope); the class names what `424`'s legacy column calls,
    # and the CALLABLE FORM plus its argument shape is declared as DATA in the enforcement manifest
    # at `permissions[<code>].arm3Door` — arm12 binds the two and refuses generation if they part.
    ('commission.forms.read',              'rls_form_matrix_targeted_version',          'commission'),
    ('commission.roster.read',             'rls_profiles_comember_or_self', 'commission'),
    ('commission.meetings.read',           'can_reach_meeting',                  'commission'),
    ('commission.meetings.cases.shell.read', 'can_reach_meeting_not_respondent',      'commission'),
    ('commission.meetings.minutes.sign',   'can_sign_meeting',                   'commission'),
    ('commission.cases.deliberation.read', 'case_caps_deliberation', 'commission'),
    ('commission.action_items.read',       'can_read_action_item',         'commission'),
    ('commission.cases.vote',              'cast_case_vote_guard',               'commission'),
    ('commission.accreditation.read',      'rls_accreditation_frameworks_owner_null', 'commission'),
    ('commission.documents.read',          'rls_controlled_documents_approver',  'commission'),
    ('commission.capa.read',               'can_read_capa',                      'commission'),
    # ⭐ THE ONE NON-CARRYING REP, and it is not filler: `commission.responses.create` is the ONLY
    # membership-gated WRITE policy in the database (matrix § 2), so it keeps the write polarity in
    # the sweep and it is the subject at which `memberGateArm = none` is measured. Without a
    # non-carrying rep the inert value would appear in no cell and arm7 would refuse.
    ('commission.responses.create',        'is_member_of_for',                   'commission'),
]

REPS_BY_ROLE = {'staff_admin': REPS, 'staff': REPS_STAFF}

# ── Axis disposition. EVERY axis the JSON declares must appear here, or arm7 refuses. ──
# 'swept'       — this generator iterates the axis; every declared value must be emitted or
#                 named in EXCLUSIONS.
# anything else — a reason string saying why the axis is not a loop coordinate here. ⚠ A reason
#                 is a claim that goes stale silently; each names the document that would
#                 contradict it.
AXIS_DISPOSITION = {
    'persona':        'swept',
    'role':           'swept',
    'activeContext':  'swept',
    'scope':          'swept',
    'principalState': 'swept',
    # ⭐ AE5-MATRIX-ARM3-CELLS (PO ruling R1, 2026-09-10). Arm 3 of app.can_read_professional_profile
    # was a FOOTNOTE in this generator and a global sentinel in 403 §7.3; it is now a loop
    # coordinate, so every arm-3 answer is attributable to a cell instead of to a prose caveat.
    'caseReach':      'swept',
    # ⭐⭐ AE5-STAFF, lead decision L1 (option (a′)) as CORRECTED by ruling L2, 2026-09-13.
    # An earlier revision of this file dispositioned the axis `not-swept` here, on the measured
    # ground that `app.is_member_of_for` reads none of the eleven terms. ⛔ THE MEASUREMENT WAS
    # RIGHT AND THE CONCLUSION WAS WRONG: the fix is not to stop sweeping the axis, it is to stop
    # using the bare membership predicate as the legacy side. ADR 0175 D3 — "403 calls the real
    # door now" — is the shape, and REPS_STAFF now keys each carrying row on its DOOR, which does
    # read its own term. ⭐ A vector column no assertion reads is a keystone that cannot fail; so
    # is an axis deleted because nothing was reading it.
    'memberGateArm':  'swept',
    'operation':      'not-swept: stood in for by the legacy-class REPS above. Per-permission '
                      'AXES are not observable until AE5 gives a role a partial map; per-permission '
                      'GRANT is covered by 401 §19.4 (403 header, PER-PERMISSION GRAIN).',
    'resourceLifecycle': 'not-swept HERE, and as of AE5 increment 1 that is a BOUND rather than '
                      'a property: matrix § 5.3 reclassified row 20 '
                      '(commission.referrals.metadata.read) ONTO this axis, because its '
                      'target-side conjunct is `case_referral.status <> \'draft\'` and `draft` is '
                      'a value this axis declares. The per-operation map IS populated — the '
                      'enforcement manifest carries `axes.resourceLifecycle = [not_applicable, '
                      'draft]` on that row and the mjs sibling reads it — but no REPRESENTATIVE '
                      'here sweeps it yet, because the referral code is not among REPS_STAFF. '
                      '⛔ OWED, and named so it cannot be mistaken for a property: giving the '
                      'referral row a representative makes this a loop coordinate and is the next '
                      'increment of this generator, not a silent gap.',
    'sensitivity':    'not-swept: sensitivity_ceiling is DEFERRED in Increment 1 (ADR 0172); all '
                      '42 seeded permissions carry a ceiling but no site enforces one yet, so the '
                      'axis has no observable effect to differentiate.',
}

# ── Values this generator deliberately does NOT emit. arm7 accepts only named exclusions. ──
EXCLUSIONS = {
    ('principalState', 'offboarded'):
        'PO-RULED (ADR 0175 D1): NOT A DENY CLASS, and PROVEN STRUCTURALLY rather than by cells. '
        '⛔ THE REASON CHANGED ON 2026-09-01 AND THE OLD ONE READ AS CARE — it said "expected '
        'values NOT YET PO-APPROVED ... routed to the PO batch", which implied the only thing '
        'missing was a ruling. It was not: these cells are UNCONSTRUCTIBLE by this fixture. 403 '
        'contains ZERO occurrences of `affiliation` and creates no affiliation row for any of its '
        'three synthetic principals, and its driver (403 §5) has no `offboarded` branch — it '
        'resets, then handles deactivated/suspended/pending only. So FOUR of the five personas '
        'are ALREADY permanently offboarded (their offboarded cell would be byte-identical to '
        'their active cell) and subject_holder (chefe.ccih, 1 live org affiliation) would run '
        'ACTIVE under an offboarded label — the same defect the anonymous exclusion below exists '
        'to delete. ⭐ The property is instead asserted where it is true for ALL inputs, not 91 '
        'sampled ones: pgTAP 401 §20 — no function on the staff_admin path references an '
        'affiliation relation, measured on BOTH halves of the differential. ⚠ ONE HOP, not the '
        'transitive closure (ADR 0175 D1 carries the bound).',
    ('persona', 'anonymous'):
        'PO-RULED (ADR 0175 D2): DELETED, not relabelled. These nine cells claimed to test the '
        'unauthenticated layer and could not — the harness maps `anonymous` to f.nobody, the SAME '
        'AUTHENTICATED principal as `unprivileged`, so they passed on "not a holder" and proved '
        'nothing about anonymity (QA F8). ⭐ Their replacement is STRICTLY STRONGER and already '
        'exists: pgTAP 401 §18 — no application role holds USAGE on `authz`, so an anonymous '
        'caller cannot invoke the resolver at all. A structural closure beats a behavioural '
        'sample, which is the only condition under which deleting an assertion is honest rather '
        'than convenient. ⛔ Do not re-emit this persona to raise the cell count: without a '
        'driver that actually drops the JWT, the cells come back exactly as vacuous as they left.',
    ('scope', 'zero_scope'):
        'UNCONSTRUCTIBLE for this subject. `zero_scope` is platform_admin\'s shape; '
        '`memberships_scope_shape` refuses a commission-scoped role row with no commission_id, so '
        'no staff_admin assignment can exist at this coordinate. A cell asserting a denial here '
        'asserts a state the schema cannot produce.',
}

# ── THE ARM-3 GATE, NAMED IN THREE VOCABULARIES, AND arm9 BINDS ALL THREE ─────────────────
# ⚠ Defined HERE, above the exclusion dicts, because the gate-scoped exclusion's reason quotes
# them; the arm-3 label machinery further down uses the same constants rather than re-typing them.
ARM3_GATE = 'can_read_professional_profile'   # the legacy CLASS this generator dispatches on
ARM3_REP_CODE = 'org.professionals.read'      # the same gate as the ENFORCEMENT MANIFEST keys it
ARM3_CASE_ARM_FN = 'app.can_read_case_committee'   # the open arm whose presence IS the case arm
# The one reach every representative gets, case-armed or not. `none` and not another value because
# it is the state 403's driver actually constructs today (it has no case_reach branch), so a cell
# kept at this reach is the cell that already existed before the axis — byte-identical, not a
# newly-invented coordinate standing in for four.
ARM3_INERT_REACH = 'none'

# ── THE MEMBER GATE ARM, BOUND TO THE MANIFEST THE WAY arm9 BINDS caseReach ──────────────
# The inert value every representative gets, carrying-row or not. `none` and not another value
# because it is the state the driver already constructs — a cell kept here is the cell that
# existed before the axis, byte-identical, not a newly-invented coordinate standing in for five.
MEMBER_GATE_INERT = 'none'
# ⛔ MANDATORY, and for `caseReach.unreachable`'s exact reason: row 15's role-free disjunct is a
# PUBLIC arm (`owner_commission_id IS NULL` grants EVERY authenticated caller), so a limb-(b) deny
# cell measured at `disjunct_present` CANNOT FAIL. This value is the state where the disjunct's
# source row does not exist, which is the only coordinate at which a limb-(b) deny is attributable
# to the membership predicate rather than to the disjunct being incidentally false.
MEMBER_GATE_MANDATORY_LIMB_B = 'disjunct_absent'


def member_gate_arms_for(code):
    """The declared value set for ONE representative, READ FROM THE ENFORCEMENT MANIFEST.

       ⛔ NOT a static list in this file. The premise of the gate-scoped rule below — "these reps
       carry these coordinates" — is a claim about the approved matrix, and a claim a generator
       makes about itself is not a detector (the arm9 lesson). arm11 re-reads this on every run
       and refuses to emit when the manifest and this generator's loop disagree."""
    if MANIFEST_PERMISSIONS is None:
        return None
    row = MANIFEST_PERMISSIONS.get(code)
    if row is None:
        return None
    return row.get('memberGateArm')


def _fixtures():
    """The axis-level fixture bindings, from the manifest (L9′). ⛔ NOT constants in this
       file: a persona's uid and a scope's commission are FIXTURE facts, and the whole point of
       this landing is that a fixture fact has one home."""
    if MANIFEST_PERMISSIONS is None:
        return {}
    return _MANIFEST_ROOT.get('differentialFixtures') or {}


def principal_uid(persona):
    return (_fixtures().get('personaUid') or {}).get(persona, '')


def scope_id_for(scope):
    return (_fixtures().get('scopeCommission') or {}).get(scope, '')


# ⚠ Rows whose PROBE keying differs from § 5.4's site keying for a STRUCTURAL reason
# (the bare rows: production site caller-keyed, probe `_for` principal-keyed — ADR
# 0201 D1). Counted and printed, never silenced; the PO may rule at the gate.
_KEYING_CENSUS = []
SKIP_NO_SCOPE_FIXTURE = 'no_resource_fixture_at_this_scope'
SKIP_NOT_EXECUTABLE = 'door_is_a_write_guard_not_executable'


def probe_reads(code, perms=None):
    """(table, column) the DOOR reads — NOT necessarily the table the fixture is named after.

       ⛔⛔ `app.can_read_document` resolves its resource in `public.documents`, while row 16's
       fixtures were named after `controlled_documents`; the lookup found no row and the door
       denied EVERY persona, silently. My smoke checked presence in the table the binding
       DECLARED, which is exactly why it stayed green while the probe measured nothing.
       ⭐ A presence check is only a control if it looks where the DOOR looks."""
    p = probe_for(code, perms)
    if not p:
        return (None, None)
    return (p.get('probeReadsTable'), p.get('probeReadsColumn') or 'id')


def _resolved_fixture(code, persona, gate, scope):
    v = probe_fixture(code, persona, gate, scope)
    return principal_uid(persona) if v == '{uid}' else v


def _needs_resource(code):
    """Whether this row's probe names a RESOURCE at all. The bare rows do not — their probe is
       the membership predicate over the cell's scope, which every scope has by definition."""
    p = probe_for(code)
    if not p or p.get('kind') == 'not-executable':
        return False
    return p.get('kind') == 'rls-select' or '{resource}' in (p.get('call') or '')
SKIP_CALLER_KEYED = 'self_check_undefined_for_caller_keyed_door'


def probe_for(code, perms=None):
    """The row's executable probe declaration, READ FROM THE ENFORCEMENT MANIFEST (L9′).

       ⛔ The binding table lives THERE, not in `424` and not here: which fixture row each
       (class × gate arm) resolves to is the SEED author's fact, and it was being transcribed
       twice — once in the suite's dispatch and once in `arm3Door.expression` — which is
       how the declared door came to fuse two live policies and drop a disjunct."""
    perms = MANIFEST_PERMISSIONS if perms is None else perms
    if perms is None:
        return None
    row = perms.get(code) or {}
    return (row.get('arm3Door') or {}).get('probe') or row.get('legacyProbe')


def probe_fixture(code, persona, gate, scope=None, perms=None):
    """The fixture id this cell binds, from the declaration's `fixtures` map.

       ⚠ `_persona` marks the one map (row 4) whose value is itself keyed by persona, because
       `$1` there is the SUBJECT PROFILE: a fixed value across personas turns `subject_holder` into
       a hidden SELF-read, which is 424 § 4's own measured finding."""
    p = probe_for(code, perms)
    if not p:
        return None
    fx = p.get('fixtures') or {}
    v = fx.get(gate, fx.get('_default'))
    if isinstance(v, dict):
        if v.get('_self'):
            return '{uid}'
        # ⭐⭐ SCOPE-KEYED SINCE L9″, AND A MISSING SCOPE RETURNS None RATHER THAN FALLING BACK.
        # `legacy_sql` probes a RESOURCE while `catalog_sql` asks about the cell's SCOPE, so a
        # fallback to another scope's row makes the two sides measure DIFFERENT COMMISSIONS —
        # measured on the first loop-shaped run as 458 of 572 red cells, every one an off-CCIH
        # coordinate probing the CCIH fixture. None here becomes a NAMED SKIP, never a guess.
        if scope is not None and (set(v) & _SCOPES):
            v = v.get(scope)
        else:
            v = v.get(persona)
    return v


_SCOPES = {'own_commission', 'sibling_commission', 'foreign_org_commission'}
_LITERAL_IDS = None


def seeded_literals():
    """Every uuid that appears as a FIXED LITERAL in seed.sql or a migration.

       ⛔⛔ THE GENERATOR REFUSES TO BIND AN ID IT CANNOT FIND HERE (L9″). `action_items`' committee
       row was created with `gen_random_uuid()`, so its id was read out of the catalog at
       GENERATION time and pinned into the vector; the next reset minted a different one and the
       probe then hit a row that does not exist — a probe against a missing row returns FALSE,
       which is indistinguishable from a door that denies. ⚠ This reads FILES, never a database:
       gate 12 runs inside `npm run lint`, which must never require Docker."""
    global _LITERAL_IDS
    if _LITERAL_IDS is None:
        import os
        import re as _re
        pat = _re.compile(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-'
                          r'[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')
        here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        paths = [os.path.join(here, 'supabase', 'seed.sql')]
        mig = os.path.join(here, 'supabase', 'migrations')
        if os.path.isdir(mig):
            paths += [os.path.join(mig, f) for f in sorted(os.listdir(mig)) if f.endswith('.sql')]
        found = set()
        for p in paths:
            try:
                found |= {x.group(0).lower()
                          for x in pat.finditer(io.open(p, encoding='utf-8', errors='replace').read())}
            except OSError:
                pass
        _LITERAL_IDS = found
    return _LITERAL_IDS


def row_keying(code, perms=None):
    """`third-party-capable` iff the probe passes the cell's principal as an EXPLICIT uid arg.

       ⭐ DERIVED, NEVER LISTED (L10). A `rls-select` probe is `caller-only` by construction:
       RLS binds `auth.uid()` from the session, so there is no way to ask it about a subject who is
       not the caller — which is exactly why five of these rows' third-party cells were
       failing. arm14 cross-checks this against § 5.4's `armInterface.subject` and refuses to
       emit if the two disagree, so the derivation and the matrix cannot drift apart."""
    p = probe_for(code, perms)
    if not p:
        return None
    if p.get('kind') in ('rls-select', 'not-executable'):
        return 'caller-only'
    return 'third-party-capable' if '{uid}' in (p.get('call') or '') else 'caller-only'


def subject_keying(code, perms=None):
    """The SAME question answered from matrix § 5.4's per-site `subject`, for arm14 to compare
       against. A subject that does not begin `caller` names an explicit principal parameter
       (`p_uid` / `p_user_id` / `p_signer`).

       ⭐⭐ READS EITHER SURFACE (lead ruling L21). `armInterface` carries the per-arm subject
       while a row is pending-rekey; `enforcementSites` carries it once the row re-keys. ⛔ THIS
       FUNCTION READ ONLY THE FIRST UNTIL AE5 T7, and the consequence was not a red: T7 re-keyed
       20 rows, every `armInterface` emptied, this returned None for EVERY row, and arm14(b)
       compared None against each derived keying — a cross-check that had silently stopped
       checking. The loud half was `_flip_keying` walking off the end of the row list; the quiet
       half is the one that matters. A row is expected to move between the two surfaces exactly
       once in its life, so reading both is the only form that survives the move."""
    perms = MANIFEST_PERMISSIONS if perms is None else perms
    if perms is None:
        return None
    row = perms.get(code)
    if not isinstance(row, dict):
        return None
    sites = (row.get('armInterface') or []) + (row.get('enforcementSites') or [])
    if not sites:
        return None
    return ('third-party-capable'
            if any(not str(a.get('subject', '')).startswith('caller') for a in sites)
            else 'caller-only')


def _manifest_rows(perms):
    """The permission ROWS, never the sibling `_*_note` keys that share the mapping.

       ⛔ `manifest['permissions']` is a dict of rows PLUS documentation strings. Every scan
       that iterated it raw was one unmatched row away from `'str' object has no attribute
       'get'` — which is how a mutation helper reports "the catalog changed shape" as a stack
       trace instead of a finding. Filter once, here."""
    return [(c, r) for c, r in (perms or {}).items() if isinstance(r, dict)]


def _lit(u):
    return "'%s'" % str(u).replace("'", "''")


def legacy_sql_for(code, persona, gate, uid, scope, scope_axis=None):
    """The cell's LEGACY probe, as executable SQL.

       ⛔ NO TRANSCRIPTION. A policy door is probed by selecting the fixture row: RLS then
       evaluates the whole live policy set — every permissive SELECT policy OR'd, every
       restrictive one AND'd — so there is no second copy of the door to drift. A function
       door is the live object, called. ⚠ `auth.uid()` is deliberately absent from the text:
       it binds from the session the probe establishes, and it is the only binding that can be
       right for the bare `app.is_member_of(...)` terms these policies contain."""
    p = probe_for(code)
    if not p:
        return None
    fx = probe_fixture(code, persona, gate, scope_axis)
    if p.get('kind') == 'rls-select':
        if fx is None:
            return None
        fx = uid if fx == '{uid}' else fx
        return ('select exists(select 1 from %s where %s = %s::uuid)'
                % (p['relation'], p.get('idColumn', 'id'), _lit(fx)))
    call = (p.get('call') or '')
    call = call.replace('{uid}', _lit(uid)).replace('{scope}', _lit(scope))
    if '{resource}' in call:
        if fx is None:
            return None
        call = call.replace('{resource}', _lit(uid if fx == '{uid}' else fx))
    return 'select ' + call


def catalog_sql_for(code, principal, res, scope):
    """The CATALOG side, bound from the same three columns 424 derives today."""
    return ('select authz.candidate_has_permission(%s::uuid, %s, %s::uuid, %s)'
            % (_lit(principal), _lit(res), _lit(scope), _lit(code)))


def arm3_limb_b_reach(code, perms=None):
    """Limb (b)'s DECLARED reach for one representative, READ FROM THE ENFORCEMENT MANIFEST.

       ⛔⛔ NOT A PERSONA LIST IN THIS FILE, AND THAT IS THE WHOLE POINT (L8). "This
       disjunct fires only for these principals" is a claim about the FIXTURE and the approved
       matrix; a claim a generator makes about itself is not a detector (the arm9 lesson, and the
       same one L6 hit when `armInterface` existed only in the JSON). arm13 re-reads this on every
       run and refuses to emit when a row that sweeps `disjunct_present` declares no reach."""
    perms = MANIFEST_PERMISSIONS if perms is None else perms
    if perms is None:
        return None
    row = perms.get(code) or {}
    return (row.get('arm3Door') or {}).get('reach')


def limb_b_fires(code, persona, selfcheck, scope=None, perms=None):
    """Whether limb (b) can be TRUE at this coordinate. ⚠ Returns None — not False —
       when the row declares nothing, so "undeclared" stays distinguishable from "declared
       unreachable". Collapsing the two would let a missing declaration read as a measured
       absence, which is the UNKNOWN-vs-ABSENT shape a classifier must never flatten."""
    r = arm3_limb_b_reach(code, perms)
    if r is None:
        return None
    kind = r.get('kind')
    if kind == 'unconditional':
        return True
    if kind == 'selfcheck':
        return bool(selfcheck)
    if kind == 'personas':
        # ⭐⭐ SCOPE × PERSONA. The fixtures are scope-keyed, so the principal the limb fires for
        # differs per scope — row 11's assignee is measured diagonal (own→staff4.ccih,
        # sibling→staff1.farm, foreign→gap.xorg.b). A persona-only reach named ONE principal for
        # every scope and so flipped 40 cells where the door denies.
        by = r.get('byScope')
        if by is not None:
            return persona in (by.get(scope) or [])
        return persona in (r.get('personas') or [])
    return None


def arm3_door_expr(code):
    """The callable the differential's LEGACY column must evaluate for this row, from the manifest.

       ⛔ Emitted INTO the vector as a column so `424` reads it from the cell rather than
       re-deriving it — a suite that re-derives the door is a suite that can drift from the
       declaration this file swept the axis against. `(none)` for a representative with no arm-3
       door, which is the honest value: its legacy side is the membership predicate."""
    if MANIFEST_PERMISSIONS is None:
        return '(manifest unreadable)'
    row = MANIFEST_PERMISSIONS.get(code) or {}
    door = row.get('arm3Door')
    if not door:
        return '(none)'
    return '%s :: %s' % (door.get('expression', '(no expression)'),
                         ', '.join(door.get('args', [])) or '(no args)')


# ── CONDITIONAL (GATE-SCOPED) EXCLUSIONS — the same reasoned-exclusion idiom, one grain finer. ──
# EXCLUSIONS above deletes an axis value from the WHOLE population; an entry here deletes it only
# where it is INERT, and it is held to the same bar: arm7 refuses an unreasoned one, because an
# unreasoned exclusion is a default in disguise. ⛔ These are NOT axis-value keys — the second
# element is a RULE NAME, and `build()` implements the condition. The rule name is what the skip
# census counts, so the deletion is always attributable to a sentence someone wrote.
CONDITIONAL_EXCLUSIONS = {
    ('memberGateArm', 'not_declared_for_this_representative'):
        'GATE-SCOPED, EXACTLY AS `caseReach` IS, AND FOR THE SAME REASON. The eleven `staff` rows '
        'that carry a matrix § 5.3 coordinate carry DIFFERENT ONES: six carry limb (a) only (a '
        'further conjunct that can turn a grant into a deny), three carry limb (b) only (a '
        'role-free disjunct that can satisfy a deny without the predicate), and two carry both. A '
        'row that carries neither limb cannot answer differently at any value of this axis, so '
        'sweeping it there emits cells differing only in a column its door never reads — the '
        'duplicate-cell inflation measured at 2592 cells when the sibling axis was swept '
        'unconditionally. ⛔⛔ THE VALUE SET PER ROW IS NOT THIS FILE\'S CLAIM: it is read from the '
        'enforcement manifest at `permissions[<code>].memberGateArm`, beside the `arm3Door` that '
        'says what the legacy column calls, and arm12 refuses to emit the moment REPS_STAFF and '
        'those declarations disagree in either direction. ⚠ `disjunct_absent` is MANDATORY on every '
        'limb-(b) row and may not be dropped to save cells: row 15\'s disjunct is a PUBLIC arm '
        '(`owner_commission_id IS NULL` grants every authenticated caller), so a deny cell measured '
        'anywhere else on that row CANNOT FAIL.',
    ('caseReach', 'inert_outside_the_arm3_gate'):
        'GATE-SCOPED, AND THE AXIS IS GATE-SPECIFIC BY CONSTRUCTION. `caseReach` coordinates ONE '
        'arm of ONE gate body: the case arm of app.can_read_professional_profile. A gate whose '
        'body has no case arm cannot answer differently at any reach, so sweeping the reach there '
        'produces cells that differ only in a column their door never reads. MEASURED at the '
        'unconditional sweep (2026-09-10): the four non-arm-3 representatives held 3456 cells '
        'carrying 864 DISTINCT PAYLOADS — 2592 were exact copies differing solely in a '
        '`case_reach` value with no arm to consume it. ⛔ Duplicate cells that cannot discriminate '
        'anything INFLATE APPARENT COVERAGE, which is the vacuous-assertion family this tree '
        'gates against (docs/learning/LESSONS.md); they are not a cheap insurance policy. ⚠ AND '
        'THEY PRE-PAY NOTHING: the staleness risk is IDENTICAL under both designs, because the '
        '`arm3:not-in-gate` label those 3456 cells carried was itself computed from ARM3_GATE, a '
        'static name in this file — it would no more auto-notice a newly-grown case arm than this '
        'skip rule would. The unconditional sweep bought four times the 403 runtime and not one '
        'detector. ⭐ THE AUTHORITY FOR *WHICH* GATE HAS THE CASE ARM IS NOT THIS FILE: it is the '
        'enforcement manifest, supabase/tests/vectors/authz-enforcement-manifest.json, at '
        '`permissions["org.professionals.read"].legacyEquivalence.openArms`, which names '
        '`app.can_read_case_committee` — the arm that reduces to C ∧ D over app._case_caps. At the '
        'head measured here that is the ONLY permission in all 43 carrying an openArms list at '
        'all. ⛔⛔ STANDING CONDITION, NOT A HOPE: IF ANY OTHER PERMISSION\'S `openArms` GAINS '
        '`app.can_read_case_committee`, THIS EXCLUSION MUST BE REVISITED — a second case-armed '
        'gate makes the reach live for a representative this rule is deleting it from, and the '
        'deletion becomes a silent coverage loss of exactly the shape AE4.9 and ADR 0201 D5 each '
        'produced once. That condition is ENFORCED, not merely written down: arm9 reads the '
        'manifest on every run and refuses to emit the moment the case-armed representative set '
        'stops being {%s}. ⚠ Enforced AT REP GRAIN, which is the exact grain of the rule — a '
        'non-representative permission growing the arm changes no emitted cell, and would red '
        'arm9 the instant it became a representative.' % ARM3_GATE,
}

# ── Axis values, READ FROM THE JSON. ⛔ Never re-list them here. ────────────────────────
def axis_values(name):
    return list(spec['axes'][name]['values'].keys())

personas    = axis_values('persona')
contexts    = axis_values('activeContext')
scopes      = axis_values('scope')
states      = axis_values('principalState')
reaches     = axis_values('caseReach')
subject_roles = list(spec['subjectRoles'])

HOLDS_AT = {                       # where each persona holds the subject role (axes file, Axis 1)
    'subject_holder':          'own_commission',
    'other_commission_holder': 'sibling_commission',
    'cross_org_actor':         'foreign_org_commission',
    'unprivileged':            None,
    'anonymous':               None,
}
SAME_ORG = {'own_commission', 'sibling_commission'}   # foreign_org_commission is the other org

# ⛔ A persona the JSON declares but HOLDS_AT does not map would otherwise KeyError at emit time
# for some coordinates and silently pass for others. Fail at the top, loudly.
_unmapped = [p for p in personas if p not in HOLDS_AT]
assert not _unmapped, 'persona(s) declared in the axes JSON with no HOLDS_AT mapping: %s' % _unmapped
# ⛔ THE SINGLE-ROLE ASSERT IS REPLACED, NOT DELETED. It read `len(subject_roles) == 1` and was
# correct for as long as AE4 substituted one role; AE5 increment 1 makes it false. A deleted
# assertion is a detector retired with no replacement, so it becomes a bound that still refuses
# something: every subject role must have a representative list here AND an approved suite in the
# enforcement manifest. That mirrors the .mjs sibling's ARM C3 on this side of the fence, so the
# two files cannot drift apart while each reads a different half.
assert subject_roles, 'the axes file declares no subjectRoles'
_missing_reps = [r for r in subject_roles if r not in REPS_BY_ROLE]
assert not _missing_reps, 'subjectRole(s) with no representative list: %s' % _missing_reps
_orphan_reps = [r for r in REPS_BY_ROLE if r not in subject_roles]
assert not _orphan_reps, 'representative list(s) for a role the axes file does not declare: %s' % _orphan_reps


def expected(role, persona, ctx, scope, state, selfcheck, res_scope):
    """EXPECTED VALUES COME FROM EXACTLY TWO HAND-ENCODED SOURCES — never resolver logic.

       ⭐ `role` IS A PARAMETER AS OF AE5 INCREMENT 1 and it is deliberately NOT branched on: the
       (1) below holds for BOTH subject roles because REPS_BY_ROLE is built that way — every rep
       is a code its own role holds. The parameter exists so the docstring's claim is checkable
       per role and so a future role whose reps are not all held cannot inherit this silently.
       (1) the approved matrix row: the subject role holds EVERY code in its own REPS —
           for `staff` that is matrix § 5.2's 20 PO-approved rows (2026-09-13); for staff_admin — after AE4.7c that is
           org.professionals.create, NOT .manage, which staff_admin lost; and the Batch 10 fifth
           rep org.participants.external.manage is held too (measured in authz.role_permissions,
           and asserted independently by 401 §19.4, whose expected value names the ONE code
           staff_admin does not hold);
       (2) the approved deny-class effect table, transcribed in its stated precedence.
       No scope-reaching join, no closure lookup, no role_permissions read."""
    # ⛔ DEAD BY EXCLUSION, KEPT AS A LOUD GUARD (ADR 0175 D2). This used to return
    # 'deny-class:unauthenticated' for a principal that is in fact AUTHENTICATED. Deleting the
    # branch outright would let a future removal of the persona exclusion silently resurrect the
    # vacuous class with a plausible label; raising makes that removal fail at generation time
    # and forces whoever does it to build the JWT-less driver first.
    if persona == 'anonymous':
        raise AssertionError(
            'persona `anonymous` reached expected(): the ADR 0175 D2 exclusion was removed without '
            'a driver that actually drops the JWT. The old label deny-class:unauthenticated was '
            'FALSE — this persona is f.nobody, an authenticated principal.')
    if state == 'deactivated':   return False, 'deny-class:inactive'
    if state == 'suspended':     return False, 'deny-class:suspended'
    holds = HOLDS_AT[persona]
    if holds is None:            return False, 'matrix-row:not-a-holder'

    # ⭐ THE §11.3 PER-CLASS DIFFERENCE, and the reason the 3-class sweep earns its cost.
    # A COMMISSION-scoped permission is reached only at the very commission held.
    # An ORG-scoped one is reached from ANY commission in the same org (the ascent), so a
    # sibling-commission holder IS granted — the cell that would otherwise go untested.
    if res_scope == 'commission':
        reaches = (scope == holds)
    else:
        reaches = (scope in SAME_ORG and holds in SAME_ORG) or (scope == holds)
    if not reaches:
        cross = ('foreign_org_commission' in (scope, holds))
        return False, ('deny-class:cross_org' if cross else 'deny-class:wrong_scope')

    if ctx in ('other_role', 'absent'):
        # ⭐ ROW 7 — §6A's asymmetry. Self-check denies; THIRD-PARTY GRANTS.
        return (False, 'deny-class:wrong_active_context:self') if selfcheck \
               else (True, 'deny-class:wrong_active_context:third-party')
    # `pending` reaches here deliberately: row 5, GRANTED — not an enforcement point.
    return True, ('matrix-row' if state != 'pending' else 'deny-class:pending-is-granted')


# ══ ARM 3'S DIVERGENCE LABEL (AE5-MATRIX-ARM3-CELLS, PO ruling R1) ════════════════════════
#
# ⛔⛔ THIS IS NOT A SECOND EXPECTED VALUE, AND THE DISTINCTION IS THE WHOLE RULING.
# `expected_granted` stays what the deny-class effect table says. The label below records WHAT
# ARM 3 DOES TO THAT CELL — agree, mask, or diverge — and, when it diverges, WHOSE DIVERGENCE IT
# IS: PO-APPROVED designed reach, or a filed defect. R2: classes 3 and 4 are approved, class 5 is
# BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE.
#
# ⚠ `expected()` DELIBERATELY TAKES NO `reach` ARGUMENT, and that omission is load-bearing rather
# than lazy. 403's driver has no case_reach branch yet (increment 1 is the axis and the labels;
# the participation fixture is increment 2), so it constructs `none` for all four values and the
# door genuinely denies for want of a participation row. An expected value of GRANT here would
# red 403 for a FIXTURE reason wearing a defect's label. R2's "classes 3 and 4 take GRANT as their
# approved expected value" lands WITH the fixture, in the increment where it can be observed —
# giving `expected()` a reach parameter is what that increment does, and the signature change is
# the reviewable event.
#
# Computed by TRANSCRIPTION, exactly as `expected()` transcribes the deny-class table — from the
# arm-3 derivation measured on the live catalog at head (20261003007390, 528). pgTAP 403 binds it
# to the catalog later; ⛔ this file never queries anything.
# ⚠ ARM3_GATE / ARM3_REP_CODE / ARM3_CASE_ARM_FN / ARM3_INERT_REACH are defined ABOVE, beside the
# exclusion dicts whose reason quotes them. `ARM3_GATE` is the ONLY rep whose gate body carries a
# case arm — a claim arm9 re-reads from the enforcement manifest on every run rather than trusting.

# Two properties of each reach value, and they are the only two the label consults.
#   fires       — can arm 3 return true at this reach at all?
#   needs_role  — does the reach require the caller to HOLD a role at the case's scope? (S1/S5-S8)
#   follows_hat — does the reach pass through has_role/has_role_any/holds_role, whose trailing
#                 conjunct binds `active_role` WHEN p_user_id = auth.uid()?
REACH_PROPERTIES = {
    'none':        {'fires': False, 'needs_role': False, 'follows_hat': False},
    'unreachable': {'fires': False, 'needs_role': False, 'follows_hat': False},
    'role_keyed':  {'fires': True,  'needs_role': True,  'follows_hat': True},
    'grant_keyed': {'fires': True,  'needs_role': False, 'follows_hat': False},
}

# The label vocabulary. arm8 refuses anything outside it, and anything blank.
ARM3_DIVERGENCE_VALUES = {
    'arm3:not-in-gate':
        "this representative's gate has no case arm; caseReach is inert here",
    'arm3:blocked:principal-state':
        '_case_caps STEP 2 (app.is_active) returns 0 for EVERY case — arm 3 is unreachable by ANY '
        'fixture at this coordinate',
    'arm3:silent:no-participation':
        'arm 3 denies through an EMPTY JOIN — the vacuity baseline, and 403 §7.3 as a cell',
    'arm3:silent:caps-deny':
        'arm 3 denies because _case_caps withheld C and/or D — the NON-VACUOUS deny',
    'arm3:silent:reach-needs-a-role':
        'a role-keyed reach cannot fire for a persona that holds no role',
    'arm3:silent:reach-follows-the-hat':
        '⭐ THE HAT SHUTS THE REACH FROM THE INSIDE: at a role-keyed reach the same wrong/absent '
        'hat the deny-class table denies on ALSO shuts arm 3, in holds_role\'s trailing conjunct. '
        '⚠ This read "— which is what grant_keyed does not do" until ADR 0209. grant_keyed is now '
        'shut too, but ONE LAYER UP: by the door-level term, never by the reach, which stays '
        'role-free. What this label names is WHERE the hat binds, not whether it binds',
    'arm3:masking':
        '⚠ arm 3 AGREES with an expected GRANT and masks the arm the cell names',
    'arm3:divergent-approved:not-a-holder':
        'arm 3 grants where the table denies — PO-APPROVED (R2): an explicit case grant needs no role',
    'arm3:divergent-approved:cross-org':
        'arm 3 grants where the table denies — PO-APPROVED (R2): an explicit case grant anchors on '
        'the CASE, never on the caller\'s org',
    'arm3:pre-empted:door-hat-term':
        '⛔ THE DOOR DENIES BEFORE ARM 3 IS EVALUATED (ADR 0209 D1) — a SELF-check by a principal '
        'who HOLDS at least one live role, presenting a hat that is none of them. The reach is '
        'still built and still role-free; it is PRE-EMPTED, which is why this is not a `silent:` '
        'label: nothing about the reach changed, the door stopped asking',
    'arm3:divergent-defective:hat-unenforceable':
        '⛔ RETIRED 2026-09-11 — FIXED by ADR 0209 / migration 20261003007400, and NO cell carries '
        'it today (its ten coordinates now carry `arm3:pre-empted:door-hat-term`). ⛔ KEPT '
        'DECLARED ON PURPOSE: arm10(b) keys on the `arm3:divergent-defective:` FAMILY rather than '
        'on this one name, and --self-test SYNTHESISES a cell carrying it, so the arm that refuses '
        'a filed defect laundered into an approved legacy GRANT stays exercised against a defect '
        'nobody has filed yet. Deleting this entry disarms that detector',
    'arm3:divergent-approved:role-free-disjunct-ignores-principal-state':
        'PO-RULED (P1, 2026-09-14, "accept the exception"): the limb-(b) ROLE-FREE DISJUNCT of '
        'this row grants any AUTHENTICATED caller and carries NO `app.is_active` term, so the '
        'LEGACY DOOR GRANTS WHERE THE CATALOG DENIES ON PRINCIPAL STATE. Measured on all five '
        'limb-(b) rows: `accreditation_frameworks_select` (`owner_commission_id IS NULL`, a '
        'PUBLIC arm), `profiles_select_self_or_admin` (the `id = auth.uid()` self leg), '
        '`app.can_access_targeted_version`, `app.is_document_approver_of`, and '
        '`action_items_select`\'s assignees_only leg. ⛔ THE APPROVAL IS THAT THE DOOR '
        'BEHAVES THIS WAY TODAY, NOT THAT IT SHOULD: the behaviour is filed as '
        'BUG-AE5-STAFF-INACTIVE-BYPASSES-ROLE-FREE-DISJUNCTS (critical, open) and its fix is '
        'unit AE5-INACTIVE-DISJUNCT-GUARD, expiry = after this increment\'s gate (PA-F8 '
        'disposition (b), owner backend). ⇒ THIS LABEL IS EXPECTED TO BE RETIRED by that '
        'unit, and the day it is, these cells lose their divergence and `expected_legacy_granted` '
        'returns to `expected_granted`. A label that outlives its bug is a pinned defect. '
        '⭐ It is the FIRST approved divergence where the legacy side is wider than the '
        'catalog for a reason the catalog COULD have caught — the other two members are '
        'approved REACH, this one is approved BLINDNESS',
    'arm3:divergent-narrower:door-conjunct-unmet':
        'PO-RULED (P2, 2026-09-14, "intended composition"): at `memberGateArm = conjunct_unmet` '
        'the door\'s further conjunct is FALSE by the coordinate\'s own definition, so the '
        'LEGACY DOOR DENIES a principal the CATALOG GRANTS. ⛔ THE NARROWER DIRECTION, and '
        'the first one this file has ever carried: `expected_legacy_granted` is FALSE while '
        '`expected_granted` stays TRUE. ⚠ NOT A DEFECT AND NO BUG IS FILED — a door '
        'denying on its own documented conjunct is the door working; the divergence is that a '
        'permission code cannot carry a non-permission term, which is what the memberGateArm axis '
        'exists to record. Mechanisms, one per row: meetings `visibility_policy`/attendee · '
        '`attendance` + `status=in_signature` · `explicit_grants_only` · '
        '`visibility_scope` · the ethics-details guard · `capa_plan.source` · '
        'the co-member leg. ⛔ NO conjunct is promoted to a catalog axis value by this '
        'ruling (matrix § 11 item 5\'s `in_signature` alternative stays unexercised)',
}

# ── THE SECOND EXPECTED VALUE (AE5-MATRIX-ARM3-CELLS increment 3) ────────────────────────
# ⛔⛔ INCREMENT 1 PREDICTED THE WRONG HOME FOR R2's GRANT, AND THE FIXTURE MEASURED IT.
# Its note said "R2's GRANT values land when `expected()` gains a `reach` parameter". They
# cannot, and the reason is a fact about the two subjects 403 compares — not a preference:
#   `expected_granted` is the value 403 §5.1 compares against `authz.candidate_has_permission`,
#   a pure role/permission resolver (assignment_facts x role_permissions x closure x
#   scope_reaches) with NO case arm. MEASURED LIVE at head (20261003007390, 528), at the
#   class-4 grant_keyed coordinate — an org-B staff_admin, an org-A professional profile, a
#   case_access_grants row on an org-A case:
#       app.can_read_professional_profile  = TRUE   (arm1 f | arm2a f | arm2b f | caps 6)
#       authz.candidate_has_permission     = FALSE
#   Flipping `expected_granted` to GRANT would therefore have RED §5.1 on every divergent cell,
#   and it would have been WRONG to do so: the resolver correctly denies an org permission the
#   caller does not hold. What arm 3 reaches is NOT the permission — it is a case-grant reach the
#   permission model deliberately does not express, which is precisely why this is a legacy-vs-
#   catalog DIVERGENCE (403 §4) and not a matrix disagreement (403 §5).
# ⇒ R2's approved GRANT lands HERE, in a second column carrying the LEGACY DOOR's approved
#   answer. `expected_granted` moves by exactly ZERO cells.
ARM3_PINNED_DEFECT = 'arm3:divergent-defective:hat-unenforceable'
# ⭐⭐ ARM10(b) KEYS ON THE FAMILY, NOT ON THE NAME (ADR 0209). The one concrete member above is
# FIXED and labels zero cells today, so an arm keyed on that string alone would be a detector with
# nothing to detect and the next hand would delete it. Keyed on the prefix it still refuses the
# NEXT filed arm-3 defect the moment one is labelled, and --self-test synthesises a member so the
# arm is exercised in the meantime. ⛔ A future defect label MUST use this prefix, or arm10(b)
# cannot see it.
ARM3_DEFECT_PREFIX = 'arm3:divergent-defective:'
# The label the door-level hat term puts on the 18 cells it pre-empts (ADR 0209 D1/D5).
ARM3_PREEMPTED = 'arm3:pre-empted:door-hat-term'
ARM3_DIVERGENT_APPROVED = ('arm3:divergent-approved:not-a-holder',
                           'arm3:divergent-approved:cross-org',
                           'arm3:divergent-approved:role-free-disjunct-ignores-principal-state')
# ⭐⭐ THE NARROWER FAMILY, AND THE PREFIX IS THE WHOLE DESIGN (P2). Both existing
# families mean THE LEGACY DOOR GRANTS — `divergent-approved:` an approved grant,
# `divergent-defective:` a filed one — and arm10 is built on that assumption: arm10(a)
# refuses an approved-labelled cell that expects a legacy DENY, which is exactly what these cells
# must expect. ⛔ Reusing either family would make arm10(a) fire on correct cells, and the
# repair a later hand reaches for is to WEAKEN arm10(a).
ARM3_NARROWER_CONJUNCT_UNMET = 'arm3:divergent-narrower:door-conjunct-unmet'


def expected_legacy(exp, div):
    """The approved answer for the LEGACY DOOR, transcribed from PO ruling R2.

       ⛔ NOT a copy of `expected_granted` with a fudge, and ⛔ not resolver logic: it is
       `expected_granted` plus exactly the divergences R2 RULED APPROVED — "the case-grant path
       deliberately anchors on the case, not on the caller's org or role. That is the whole point
       of an explicit grant." Every other cell keeps the matrix answer, so the two columns are
       identical wherever no approved divergence was ruled, and 403 §4.1 keeps comparing
       legacy against catalog on exactly those cells.

       ⛔⛔ NEITHER THE FILED DEFECT NOR THE PRE-EMPTED CELLS ARE LISTED HERE, AND THAT OMISSION
       IS THE RULING. The old class 5 (`ARM3_PINNED_DEFECT`) kept the matrix answer FALSE — the
       hat rule SHOULD deny — while the door returned TRUE; encoding today's behaviour as the
       approved value is the one thing R2 forbids, so it was carried as a CARVE-OUT plus 403
       §7.4's head-on assertion, never as an expected value. ⭐ ADR 0209 FIXED THE DOOR, so those
       cells (and eight re-ruled cross-org siblings) now carry `ARM3_PREEMPTED`, keep the matrix
       answer FALSE, and are no longer excused from anything: §7.4 is deleted and §4.1/§4.1b
       compare them BY VALUE like every other cell. The route was the one §7.4's own message
       named — delete the section and drop the carve-out — never editing "granted on 10".

       ⚠ A `divergent-approved` cell always has `exp is False` BY CONSTRUCTION — arm3_divergence
       returns `arm3:masking` before it reaches the divergent branches whenever `exp` is true. So
       arm10(a) below, which requires those cells to expect a legacy GRANT, subsumes the
       "this column is just a copy of expected_granted" shape entirely, and no separate
       copy-detector is written: an arm that cannot fire on its own is the vacuity this file
       exists to refuse."""
    # ⛔⛔ THE NARROWER DIRECTION, AND THIS FUNCTION HAD NO PATH FOR IT (P2). Every
    # branch below returns True or falls through to `exp`, because until AE5 increment 1 every
    # ruled divergence was the legacy door being WIDER than the catalog. `conjunct_unmet` is the
    # first that is NARROWER: the door's own further conjunct is false, so it denies a principal
    # the catalog grants. Returning `exp` there would assert the door GRANTS, which is the one
    # thing the coordinate means it does not. ⚠ It is placed FIRST so that it cannot be
    # reached only when the approved tuple happens to miss — the two families are disjoint
    # by construction and this ordering states that rather than relying on it.
    if div == ARM3_NARROWER_CONJUNCT_UNMET:
        return False
    if div in ARM3_DIVERGENT_APPROVED:
        return True
    return exp


# ⛔ CELLS CARRYING THESE LABELS ARE NOT ARM-3 COVERAGE, and the header counts them separately so
# the number cannot be quoted as one. `blocked:principal-state` is class 1's 108 base cells: no
# fixture can make arm 3 fire there, so they measure the deny-class table and say NOTHING about
# arm 3. `not-in-gate` is a different door entirely. Counting either as arm-3 coverage would
# inflate the report with cells that cannot fail for an arm-3 reason.
NOT_ARM3_COVERAGE = ('arm3:not-in-gate', 'arm3:blocked:principal-state')


def arm3_divergence(klass, persona, ctx, scope, state, selfcheck, exp, src, reach, gate, code):
    # ⚠ `scope` was already a parameter and was NOT being used by the limb-(b) branch — the
    # reach lied at every off-own scope while the fixtures had moved on without it.
    """Transcribed from the arm-3 derivation, in PRECEDENCE ORDER. Each branch names the catalog
       fact it stands for; none of them re-derives `expected_granted`."""
    # ⭐⭐ THE TWO memberGateArm BRANCHES ARE TESTED BEFORE THE `klass != ARM3_GATE`
    # SHORT-CIRCUIT, AND THAT PLACEMENT IS LOAD-BEARING. Every `staff` representative returns
    # `arm3:not-in-gate` at that line, so a branch placed after it could never be reached: the
    # labels would be declared, carried by ZERO cells, and arm8's single-valued check would be the
    # only thing that noticed. ⚠ STAFF_ADMIN IS UNTOUCHED BY BOTH: its cells all sit at the
    # inert gate value, so neither predicate can match and its 1728 rows stay byte-identical.
    #
    # (P2) The door's further conjunct is FALSE and the catalog GRANTS — the legacy door is
    # NARROWER. ⛔ `and exp` is the predicate, not a convenience: where the catalog already
    # denies there is nothing to diverge from, and labelling those cells would claim a divergence
    # in a place both sides agree.
    if gate == 'conjunct_unmet' and exp:
        return ARM3_NARROWER_CONJUNCT_UNMET
    # (P1) The role-free disjunct grants any authenticated caller and the catalog DENIES —
    # the legacy door is WIDER. ⛔ `and not exp` is likewise the whole predicate: where the
    # catalog already grants there is no divergence to approve, and labelling those cells would
    # make `expected_legacy_granted` agree with `expected_granted` UNDER a divergent label, which
    # reads as an approved divergence that is not one.
    # ⛔⛔ AND IT IS GATED ON THE DECLARED REACH (L8). The first cut of this branch
    # flipped ALL 198 cells per row on all five rows — 990 — on the reading that limb
    # (b) is "role-free". It is role-free, but only ONE of the five disjuncts is also
    # PRINCIPAL-free: `accreditation`'s `($1 is null)` is resource-keyed and grants anyone, while
    # `forms`/`documents`/`action_items` fire only for a principal the FIXTURE names and
    # `roster`'s `($1 = $2)` fires only on a self-check. 430 of the 990 were measured denying in
    # 424 § 4.1b, every one reporting `legacy=false` against this column's `true`.
    # ⛔ A cell where the legacy door does not grant is NOT divergent, so the PO's P1 ruling
    # — which is about how an approved divergence is ENCODED — never reached it.
    if gate == 'disjunct_present' and not exp and limb_b_fires(code, persona, selfcheck, scope):
        return 'arm3:divergent-approved:role-free-disjunct-ignores-principal-state'
    if klass != ARM3_GATE:
        return 'arm3:not-in-gate'

    # (1) CLASS 1 — 108 base cells. `_case_caps` STEP 2 is `if not app.is_active(p_uid) then
    # return 0`, evaluated BEFORE every positive sub-arm, so it dominates every reach value.
    # ⚠ `pending` is NOT one of these: app.is_active reads `is_active` and `suspended_until` only,
    # never `email_confirmed_at`, which is the single field 403 nulls to model `pending`.
    if state in ('deactivated', 'suspended'):
        return 'arm3:blocked:principal-state'

    props = REACH_PROPERTIES[reach]

    # (2) THE TWO SILENT REACHES — and the reason `unreachable` is not a duplicate of `none`.
    if not props['fires']:
        return 'arm3:silent:no-participation' if reach == 'none' else 'arm3:silent:caps-deny'

    # (3) A role-keyed reach needs a role. `unprivileged` holds none by definition, so S1/S5-S8
    # cannot fire for it — the cell is silent, NOT divergent. Labelling it divergent here would
    # claim a reach the fixture could never build.
    if props['needs_role'] and HOLDS_AT[persona] is None:
        return 'arm3:silent:reach-needs-a-role'

    # (4) ⭐ THE HAT, AND IT BINDS ON ONE SIDE ONLY. The trailing conjunct of has_role/
    # has_role_any/holds_role is `p_user_id is distinct from auth.uid() or p_role is not distinct
    # from app.active_role()`. Under a THIRD-PARTY probe 403 calls as f.nobody while passing
    # v_principal, so the left disjunct is true and the hat is VACUOUSLY satisfied — which is the
    # same asymmetry `expected()` encodes as row 7. So the hat can silence a role-keyed reach only
    # on a self-check.
    if props['follows_hat'] and selfcheck and ctx in ('other_role', 'absent'):
        return 'arm3:silent:reach-follows-the-hat'

    # ── ARM 3 FIRES BELOW THIS LINE. ─────────────────────────────────────────────────────────
    # (5) CLASS 2 — arm 3 agrees with an expected GRANT. Green, but green for an arm the cell does
    # not name: arm 2's positive polarity stops being measured on exactly these cells. This is why
    # `none` had to stay a VALUE rather than the fixture simply gaining participation.
    if exp:
        return 'arm3:masking'

    # (5b) ⭐⭐ THE DOOR-LEVEL HAT TERM (ADR 0209 D1), TRANSCRIBED. Since migration
    # 20261003007400 `app.can_read_professional_profile` evaluates the ACT hat BEFORE any arm: a
    # SELF-check by a principal who HOLDS at least one live role, under a hat that is none of
    # them, returns false whatever arm would have answered. Arm 3's reach is still built and
    # still role-free — it is PRE-EMPTED, not silenced, which is why the label is not a `silent:`
    # one: nothing about the reach changed, the door stopped asking.
    #
    # ⛔ THE THREE CONJUNCTS ARE THE DOOR'S, ONE FOR ONE, and each carries a ruling:
    #   selfcheck             — the term mirrors has_role/is_admin_for and never touches a
    #                           THIRD-PARTY question; §6A's asymmetry (403 §5.2) is untouched.
    #   HOLDS_AT is not None  — D3. A principal with NO live role has no hat to be wrong, so the
    #                           36 `not-a-holder` cells keep the reach PO ruling R2 approved. A
    #                           hat check keyed on the HAT ALONE reds 403 §4.1b on exactly those,
    #                           which is mutant C′ and is why this conjunct is written out.
    #   ctx in (other_role,   — `matching` is a hat the persona holds, so the door falls through
    #           absent)         and 403 §7.5 SURVIVES the fix, which is what makes it a guard
    #                           rather than a second copy of the retired §7.4.
    #
    # ⚠ `absent` NEVER REACHES HERE FOR A HOLDER, and the conjunct is written anyway. build()
    # skips the coordinate (`absent_unreachable_for_single_role_principal`): the token hook mints
    # a hat implicitly for a principal holding exactly ONE role type, and every holder persona
    # holds exactly one. So D4's value — a hatless holder self-checking is DENIED — is pinned by
    # 403 directly rather than by a cell, and this clause states the door's predicate in full
    # instead of encoding the fixture's inability to build one of its coordinates.
    #
    # ⚠ PLACED AFTER `masking`, AND THAT IS SAFE ONLY BECAUSE `expected()` CANNOT PRODUCE THE
    # OVERLAP: its step 5 returns False for EVERY self-check at a wrong or absent hat, so no cell
    # can be both `exp` and hat-denied. ⛔ If `expected()` is ever changed to grant one, this
    # branch must move ABOVE masking — a hat-denied cell labelled `arm3:masking` keeps
    # expected_legacy = GRANT, and 403 §4.1b would then red with the wrong attribution.
    if selfcheck and HOLDS_AT[persona] is not None and ctx in ('other_role', 'absent'):
        return ARM3_PREEMPTED

    # (6) THE THREE DIVERGENT CLASSES. ⛔ EXHAUSTIVE BY RAISE, NOT BY `else`. A new deny class
    # arriving in `expected()` must be dispositioned here deliberately; absorbing it into a
    # default would silently label an unexamined divergence as approved — the default-arm shape
    # ADR 0176 D5 retires, one layer down where no arm in this file could see it.
    if src == 'matrix-row:not-a-holder':
        return 'arm3:divergent-approved:not-a-holder'          # class 3
    if src == 'deny-class:cross_org':
        return 'arm3:divergent-approved:cross-org'             # class 4
    # ⛔ WHAT USED TO BE CLASS 5 IS NOW UNREACHABLE, AND IT RAISES RATHER THAN BEING DELETED.
    # `deny-class:wrong_active_context:self` arises only for a HOLDER (expected() returns
    # `matrix-row:not-a-holder` first otherwise) on a SELF-check at `other_role`/`absent` — which
    # is exactly branch (5b)'s predicate, so (5b) claims every such cell before this line. If one
    # ever gets here the two have stopped agreeing, and the vector would silently regain a
    # divergent-approved GRANT on a wrong-hat self-check: the defect ADR 0209 fixed, re-entering
    # through the label. ⛔ Do NOT restore a return here — make (5b) match the door.
    if src == 'deny-class:wrong_active_context:self':
        raise AssertionError(
            'a wrong-hat SELF-check reached the divergent branches (persona=%s ctx=%s scope=%s '
            'state=%s reach=%s). Branch (5b) — the door-level hat term, ADR 0209 D1 — must have '
            'claimed it. Either `expected()`\'s precedence moved or (5b)\'s conjuncts no longer '
            'mirror the door; fix the mirror, do not re-add a label here.'
            % (persona, ctx, scope, state, reach))
    raise AssertionError(
        'arm3_divergence has no disposition for expectedSource `%s` at reach `%s` (persona=%s '
        'ctx=%s scope=%s state=%s self=%s). A deny class reached arm 3 without a PO ruling on '
        'whether its divergence is approved or defective — rule it, do not default it.'
        % (src, reach, persona, ctx, scope, state, selfcheck))


def build(personas, contexts, scopes, states, reaches, reps_by_role, exclusions, gates=None):
    gates = list(spec['axes']['memberGateArm']['values'].keys()) if gates is None else gates
    """Returns (cells, skipped). EVERY skip counter counts CELLS, at one grain, so that
       `len(cells) + sum(skipped.values())` equals the full grid exactly — asserted below.
       ⛔ An earlier shape short-circuited excluded AXIS VALUES at their own loop level, so those
       counters counted loop PREFIXES while the inner rules counted cells: a census whose parts
       cannot sum, and the header total was then a number of nothing."""
    cells, skipped = [], {}

    def skip(rule):
        skipped[rule] = skipped.get(rule, 0) + 1

    # ⛔ `reach` IS A LOOP LEVEL OUTSIDE THE SKIP RULES, NOT AN INNER FAN-OUT, AND THE SHAPE IS
    # THE POINT. An inner fan-out would have `skipped` counting PRE-REACH coordinates while
    # `cells` counted post-reach ones — the exact census-that-cannot-sum this docstring warns
    # about, one axis later. Every skip rule EXCEPT the gate-scoped one is reach-independent, so
    # each of those fires four times and the grid below multiplies by four; the gate-scoped rule is
    # reach-DEPENDENT by definition and fires three times per surviving coordinate of the four
    # inert reps. ⛔ NEITHER PROPERTY IS ASSERTED BY THIS COMMENT — `len(cells) +
    # sum(skipped.values()) == _GRID` is what proves the census, and it is the only thing that does.
    for role in sorted(reps_by_role):
      for code, klass, res in reps_by_role[role]:
        for persona in personas:
            for ctx in contexts:
                for scope in scopes:
                    for state in states:
                        for selfcheck in (True, False):
                          for reach in reaches:
                           for gate in gates:
                            # ⭐ THE NAMED AXIS EXCLUSIONS (arm7's subject). Checked here, at cell
                            # grain, and attributed to the axis value that elided the cell.
                            axis_hit = next((('%s:%s' % (a, v))
                                             for a, v in (('persona', persona), ('activeContext', ctx),
                                                          ('scope', scope), ('principalState', state),
                                                          ('caseReach', reach))
                                             if (a, v) in exclusions), None)
                            if axis_hit is not None:
                                skip('axis_excluded:%s' % axis_hit); continue
                            # ⛔ ABSENT IS NOT REACHABLE FOR A SINGLE-ROLE-TYPE PRINCIPAL.
                            # AE0.5 Axis 3: the hook emits no active_role only when the caller
                            # holds ZERO role types or MORE THAN ONE. Each holder persona here
                            # holds exactly one (staff_admin), so `absent` cannot be constructed
                            # for them — test_helpers.claims_for(uid, false, null) DERIVES the
                            # single role and sets it, which is the system behaving correctly.
                            # A cell asserting a denial there asserts a state the system cannot
                            # produce.
                            if ctx == 'absent' and persona in ('subject_holder', 'other_commission_holder', 'cross_org_actor'):
                                skip('absent_unreachable_for_single_role_principal'); continue
                            if persona == 'anonymous' and ctx != 'absent':
                                skip('anonymous_has_no_active_context'); continue
                            if persona == 'anonymous' and state != 'active':
                                skip('anonymous_holds_no_role_state'); continue
                            if persona == 'anonymous' and not selfcheck:
                                skip('anonymous_cannot_be_a_third_party_subject'); continue
                            # ⭐ THE GATE-SCOPED caseReach RULE (CONDITIONAL_EXCLUSIONS). Its reason
                            # is the dict entry; the mechanics are these three lines.
                            # ⛔ KEYED ON `klass`, THE SAME DISCRIMINANT `arm3_divergence` DISPATCHES
                            # ON, so the rule and the label can never disagree about which gate is
                            # case-armed: every cell this deletes is one that would have been
                            # labelled `arm3:not-in-gate`, and nothing else can be deleted by it.
                            # ⚠ PLACED LAST, AFTER EVERY UNCONSTRUCTIBLE-COORDINATE RULE, ON PURPOSE.
                            # Placed first it would ABSORB their counts — the four inert reps' other
                            # counters would silently drop to a quarter, and a bug in one of them
                            # would get four times quieter. Last, this counter equals EXACTLY the
                            # redundancy the rule deletes (emitted-at-HEAD minus emitted-now) and
                            # every pre-existing counter keeps the value it had, so the census diff
                            # is one new line instead of six moved ones.
                            if klass != ARM3_GATE and reach != ARM3_INERT_REACH:
                                skip('caseReach_inert_outside_the_arm3_gate'); continue
                            # ⭐ THE GATE-SCOPED memberGateArm RULE, and its premise is the
                            # MANIFEST's, not this file's — same discipline as the caseReach rule
                            # above, same reason: a generator's claim about its own coverage is not
                            # a detector. `member_gate_arms_for` reads
                            # permissions[<code>].memberGateArm; arm12 refuses to emit when that
                            # declaration and REPS_STAFF disagree.
                            _declared_gates = member_gate_arms_for(code) or [MEMBER_GATE_INERT]
                            if gate not in _declared_gates:
                                skip('memberGateArm_not_declared_for_this_representative'); continue
                            exp, src = expected(role, persona, ctx, scope, state, selfcheck, res)
                            # ⛔ `reach` IS IN THE CELL ID, AND IT HAS TO BE. Without it the four
                            # reach values collapse onto ONE id, 403 reports on cell_id, and three
                            # of every four cells become an invisible duplicate of the first.
                            # ⛔ `gate` IS IN THE CELL ID for `caseReach`'s exact reason: without
                            # it the declared gate values collapse onto ONE id, the suites report on
                            # cell_id, and every value but the first becomes an invisible duplicate.
                            # ⛔⛔ APPENDED ONLY WHEN NON-INERT, AND THAT IS NOT COSMETIC. Every
                            # staff_admin cell sits at the inert value, so an unconditional suffix
                            # would rewrite all 1728 of their ids — and `403` reports on, and joins
                            # by, cell_id. Measured: appending unconditionally made the staff_admin
                            # rows DIFFER from HEAD on the first regeneration, which is the whole
                            # non-regression property this landing rests on.
                            cid = '|'.join([persona, role, ctx, scope, code, state,
                                            'self' if selfcheck else 'third_party', reach]
                                           + ([gate] if gate != MEMBER_GATE_INERT else []))
                            div = arm3_divergence(klass, persona, ctx, scope, state,
                                                  selfcheck, exp, src, reach, gate, code)
                            # ⛔ APPENDED AS THE LAST COLUMN, NOT INSERTED BESIDE `exp`. Every
                            # arm above and every --self-test fixture below addresses cells BY
                            # INDEX (c[9] is the expected value, c[12] the label); inserting a
                            # column mid-tuple would silently re-point all of them at their
                            # neighbours, which is a whole-file mutation wearing a one-line diff.
                            exp_legacy = expected_legacy(exp, div)
                            # ⛔ `role` IS APPENDED AS COLUMN 14, NEVER INSERTED MID-TUPLE. Every
                            # arm and every --self-test fixture addresses cells BY INDEX (c[9] the
                            # expected value, c[12] the label, c[13] the legacy value); an insert
                            # would silently re-point all of them at their neighbours — a
                            # whole-file mutation wearing a one-line diff.
                            # ⭐⭐ L10 — A CALLER-KEYED DOOR HAS NO THIRD-PARTY
                            # QUESTION, AND THE COORDINATE IS SKIPPED BY NAME RATHER THAN
                            # ANSWERED. An `rls-select` probe binds `auth.uid()` from the session,
                            # so "is this OTHER principal a member" is a question it cannot be
                            # asked; the previous shape answered it anyway, by re-binding the
                            # claims to the principal, which quietly turned every third-party cell
                            # on these rows into a second self-check. ⛔ Skipped, never
                            # dropped silently: the rule is named, censused, and re-stated by
                            # arm7, so the coverage loss is visible as a number.
                            # ⛔ A DOOR THAT CANNOT BE EXECUTED FOR A TRUTH VALUE IS SKIPPED
                            # BY NAME, NEVER APPROXIMATED WITH A NEIGHBOURING PREDICATE. Row 12's
                            # guard lives inside a WRITE that raises and takes a decision id; the
                            # approximation measured a READ predicate with a different signature
                            # and asserted nothing about the guard.
                            if (probe_for(code) or {}).get('kind') == 'not-executable':
                                skip(SKIP_NOT_EXECUTABLE); continue
                            _keying = row_keying(code)
                            if _keying == 'caller-only' and not selfcheck:
                                skip(SKIP_CALLER_KEYED); continue
                            _fx = probe_fixture(code, persona, gate, scope)
                            # The self leg's subject IS the principal, so the column carries the
                            # resolved uid rather than the placeholder - it must be checkable
                            # against seed.sql like every other bound id.
                            if _fx == '{uid}':
                                _fx = principal_uid(persona)
                            # ⛔ NO RESOURCE AT THIS SCOPE => SKIPPED BY NAME, NEVER PROBED
                            # ELSEWHERE. The alternative — fall back to the commission the fixture
                            # happens to live in — is what made legacy and catalog measure
                            # different resources, and it did so silently.
                            if _needs_resource(code) and not _fx:
                                skip(SKIP_NO_SCOPE_FIXTURE); continue
                            _lsql = legacy_sql_for(code, persona, gate,
                                                   principal_uid(persona), scope_id_for(scope),
                                                   scope)
                            cells.append((cid, persona, ctx, scope, code, klass, res, state,
                                          selfcheck, exp, src, reach, div, exp_legacy, role,
                                          gate, arm3_door_expr(code),
                                          _lsql or '',
                                          catalog_sql_for(code, principal_uid(persona),
                                                          res, scope_id_for(scope)),
                                          str(_fx or ''),
                                          _keying or '',
                                          probe_reads(code)[0] or '',
                                          probe_reads(code)[1] or ''))
    return cells, skipped


cells, skipped = build(personas, contexts, scopes, states, reaches, REPS_BY_ROLE, EXCLUSIONS)
reps_flat_top = [r for _role in sorted(REPS_BY_ROLE) for r in REPS_BY_ROLE[_role]]

# ⭐ THE CENSUS SUMS. Every cell of the declared grid is either emitted or attributed to exactly
# one named rule. ⛔ Without this the header's "N skipped" is a number of nothing, and a rule that
# quietly elides a coordinate twice (or not at all) is invisible.
gates_all = list(spec['axes']['memberGateArm']['values'].keys())
_GRID = (sum(len(v) for v in REPS_BY_ROLE.values())
         * len(personas) * len(contexts) * len(scopes) * len(states) * 2 * len(reaches)
         * len(gates_all))
assert len(cells) + sum(skipped.values()) == _GRID, (
    'the census does not sum: %d emitted + %d skipped != %d declared grid cells'
    % (len(cells), sum(skipped.values()), _GRID))


_UNSET = object()   # `None` is a LEGITIMATE value for `permissions` (an unreadable manifest), so
                    # the "use the real one" sentinel cannot be None — the self-test exercises both.


def coverage(cells, skipped, reps_by_role, disposition=None, exclusions=None, axes=None,
             permissions=_UNSET, conditional=None):
    """ELEVEN ARMS. ⛔ An arm that has never refused anything is a detector nobody has shown finds
       something — every one is exercised by --self-test below."""
    # ⭐⭐ PER-ROLE ARMS, AND THE UNION IS WHAT THEY MUST NOT BE EVALUATED OVER. arm2 (polarity),
    # arm4 (§ 6A both-polarity) and arm5 (the org-scope ascent) each ask "does this cell set
    # exercise X". Over the UNION of two roles' cells every one of them is satisfiable by
    # `staff_admin` alone, so a `staff` cell set that exercised none of them would still pass —
    # the masked-arm shape this file already paid for once at AE4.7c (see the REPS comment on
    # org.professionals.create). They are therefore evaluated ONE ROLE AT A TIME and their
    # messages name the role.
    reps_flat = [r for _role in sorted(reps_by_role) for r in reps_by_role[_role]]
    cells_by_role = {}
    for _c in cells:
        cells_by_role.setdefault(_c[14], []).append(_c)
    disposition = AXIS_DISPOSITION if disposition is None else disposition
    exclusions = EXCLUSIONS if exclusions is None else exclusions
    axes = spec['axes'] if axes is None else axes
    permissions = MANIFEST_PERMISSIONS if permissions is _UNSET else permissions
    conditional = CONDITIONAL_EXCLUSIONS if conditional is None else conditional
    f = []
    if not cells:
        f.append('arm1: the cell set is EMPTY — pgTAP would iterate nothing and pass')
    for _role in sorted(cells_by_role):
        _rc = cells_by_role[_role]
        if not (any(c[9] for c in _rc) and any(not c[9] for c in _rc)):
            f.append('arm2: expected values are single-polarity for role `%s` — a resolver stuck '
                     'on one answer would pass' % _role)
    # ⭐ arm3 COMPARES SETS, DERIVED FROM `reps`, NOT A HARD-CODED 3. The literal was correct
    # for as long as there were three reps and became a false gate the moment AE4.9 added a
    # fourth — it refused a CORRECT cell set. ⛔ It is not a tautology against arm1b: arm1b
    # keys on the permission CODE (c[4]) and this keys on the legacy CLASS (c[5]), and two reps
    # may legitimately share a class, so neither implies the other.
    # ⚠ THE SWEEP COVERS 5 OF THE 6 CLASSES 401 §19.2 counts (4 -> 5 at pre-AE5 Batch 10, PO
    # ruling R4). The ONE uncovered class is can_manage_professional (row 30), and the reason is
    # unchanged: staff_admin does not hold that code, so a rep on it would make every cell of the
    # class a denial — the single-polarity trap AE4.7c already hit once.
    # ⛔ can_manage_external_participant (row 31) is NO LONGER covered by body identity — it has
    # its own rep. That reduction is retired, and 403 §2.3b now asserts the rep instead of the
    # identity.
    # ⭐ ONE NARROW, NAMED EXEMPTION: a rep whose door is declared `not-executable` emits no
    # cells BY RULE, and its absence is counted in the skip census with its reason string. ⛔ The
    # exemption is keyed on that declaration, never on a class NAME — a hand-list here would
    # silence the next silently-dropped rep, which is the only thing this arm exists to catch.
    _unexecutable = {r[1] for r in reps_flat
                     if (probe_for(r[0], permissions) or {}).get('kind') == 'not-executable'}
    _declared_classes = {r[1] for r in reps_flat} - _unexecutable
    _emitted_classes = {c[5] for c in cells}
    if _declared_classes != _emitted_classes:
        f.append('arm3: swept legacy-equivalence classes do not match the declared REPS — '
                 'declared-not-emitted %s, emitted-not-declared %s'
                 % (sorted(_declared_classes - _emitted_classes) or '(none)',
                    sorted(_emitted_classes - _declared_classes) or '(none)'))
    for _role in sorted(cells_by_role):
        _rc = cells_by_role[_role]
        if not (any(c[8] for c in _rc) and any(not c[8] for c in _rc)):
            f.append('arm4: §6A both-polarity missing for role `%s` — self-check AND third-party '
                     'are both required, or the suite passes while pinning the uniform-apply bug'
                     % _role)
    # ⭐ arm5 IS RE-PREDICATED ON THE ROLE'S OWN RESOLUTION SCOPES, not on a constant. The org
    # ascent it guards exists only where a role holds an ORG-scoped code: `staff_admin` does (four
    # of its five reps), `staff` does not — matrix § 5.2, all 20 rows resolve at `commission`. The
    # old constant predicate would have fired on every `staff` run and reported a coverage loss
    # that cannot exist, which is a false red and, worse, one a future hand would silence by
    # deleting the arm. ⛔ THE ARM MUST STILL FIRE FOR `staff_admin` — --self-test asserts BOTH
    # halves (it fires when the ascent cell is removed from staff_admin; it stays quiet on an
    # unmodified commission-only role).
    for _role in sorted(cells_by_role):
        _rc = cells_by_role[_role]
        _role_scopes = {r[2] for r in reps_by_role.get(_role, [])}
        if 'organization' not in _role_scopes:
            continue
        if not any(c[6] == 'organization' and c[3] == 'sibling_commission' and c[9] for c in _rc):
            f.append('arm5: §11.3 differing-scope cell missing for role `%s` — the whole '
                     'org-scoped class would go untested' % _role)
    if any(not c[10] for c in cells):
        f.append('arm6: a cell carries no expectedSource — an unattributed expected value is not an oracle input')

    # ⭐ arm7 — THE AXIS-COMPLETENESS ARM, and the one this generator most needed.
    # Its predecessor read `sum(skipped.values()) > 0 and not skipped`, which is tautologically
    # FALSE (a non-zero sum implies a non-empty dict), so it had never refused anything and could
    # not: it was keyed on the skip DICT, and a value that never enters the loop is not in it.
    # Keyed on the DECLARED AXES instead, it sees exactly what its predecessor could not.
    # ⛔ AN AXIS MISSING FROM THIS MAP IS AN AXIS arm7 CANNOT SEE. The lookup below falls back
    # to `emitted = declared` when a swept axis has no column, so `missing` is empty by
    # construction and the arm can never fire for it — a detector that could not fail, on the very
    # axis someone just added.
    # ⛔⛔ THE `role` EXEMPTION IS GONE, AND ITS OLD TEXT WAS TRUE ONLY WHILE ONE ROLE EXISTED. It
    # read: "`role` is the ONE tolerable case: subjectRoles is asserted to hold exactly one value
    # at the top of this file, so there is nothing for the arm to find." AE5 increment 1 makes
    # subjectRoles two-valued, and that sentence would have turned arm7 into a detector that
    # cannot fire on the axis the increment just made real. `role` now has a COLUMN (14) and is
    # held to the same bar as every other swept axis.
    # ⭐ `caseReach` -> 11 is why the reach had to become a COLUMN and not merely a cell-id suffix.
    # ⭐⭐ IT IS ALSO THE STOP ON THE GATE-SCOPED RULE, AND THE PAIRING IS DELIBERATE. That rule
    # keeps all four reaches for the arm-3 rep and one for everyone else, so `emitted` is still the
    # full declared set and arm7 stays quiet. Widen the rule by one character — drop the `klass !=
    # ARM3_GATE` guard, or point it at the wrong class — and three values appear in NO cell and in
    # NO named exclusion, which is exactly what arm7 refuses. So the saving cannot grow into a
    # silent axis deletion without this arm saying so.
    CELL_AXIS_COL = {'persona': 1, 'activeContext': 2, 'scope': 3, 'principalState': 7,
                     'caseReach': 11, 'role': 14, 'memberGateArm': 15}
    for axis in sorted(axes):
        if axis not in disposition:
            f.append('arm7: axis `%s` is declared in the axes JSON with NO disposition — it is '
                     'neither swept nor excused, which is how a whole axis disappears silently' % axis)
            continue
        if disposition[axis] != 'swept':
            continue
        declared = set(axes[axis]['values'].keys())
        col = CELL_AXIS_COL.get(axis)
        emitted = {c[col] for c in cells} if col is not None else declared
        named = {v for (a, v) in exclusions if a == axis}
        missing = declared - emitted - named
        if missing:
            f.append('arm7: axis `%s` declares value(s) %s that appear in NO cell and in NO named '
                     'exclusion — a silently dropped coordinate is invisible to every other arm'
                     % (axis, ', '.join(sorted(missing))))
    # ⛔ BOTH EXCLUSION DICTS, ONE BAR. The conditional (gate-scoped) rules shrink the population
    # exactly as the value exclusions do — they just shrink it on a condition — so an unreasoned
    # one is the same default in disguise, and arm7 refuses it on the same line.
    for (axis, value), reason in sorted(list(exclusions.items()) + list(conditional.items())):
        if not reason:
            f.append('arm7: exclusion %s.%s carries no reason — an unattributed exclusion is a '
                     'silent population shrink wearing a rule\'s clothes' % (axis, value))

    # ⭐ arm8 — THE DIVERGENCE-LABEL ARM (AE5-MATRIX-ARM3-CELLS). Modelled on arm6: arm6 refuses
    # an expected value with no attribution, and this refuses an arm-3 DISPOSITION with none.
    # ⛔ The stakes are higher than arm6's, because two of this column's values are a PO ruling
    # (R2: classes 3 and 4 are APPROVED reach) and one is a filed DEFECT that must never be read
    # as approved. A blank or unrecognised label silently merges those.
    _blank = [c for c in cells if not c[12]]
    if _blank:
        f.append('arm8: %d cell(s) carry NO arm3 divergence label — an arm-3 answer with no '
                 'disposition is indistinguishable from approved reach, a filed defect and a '
                 'structural block (first: %s)' % (len(_blank), _blank[0][0]))
    else:
        _unknown = sorted({c[12] for c in cells} - set(ARM3_DIVERGENCE_VALUES))
        if _unknown:
            f.append('arm8: arm3 divergence label(s) outside the declared vocabulary: %s — a value '
                     'nobody declared carries no ruling, and pgTAP 403 has nothing to bind it to'
                     % ', '.join(_unknown))
    # ⛔ A SINGLE-VALUED LABEL COLUMN IS A COLUMN OF NOTHING, and it is the cheapest way for this
    # axis to become decorative: collapse arm3_divergence to a constant and every other arm here
    # still passes. Same shape as arm2 for expected_granted.
    if len({c[12] for c in cells}) < 2:
        f.append('arm8: the arm3 divergence column is SINGLE-VALUED (%s) — it distinguishes '
                 'nothing, and the caseReach axis is then four copies of one cell'
                 % (sorted({c[12] for c in cells}) or ['(none)'])[0])
    # ⛔ arm8c — THE REP-LOSS SHAPE, APPLIED TO THE NEW AXIS. Twice (AE4.9, ADR 0201 D5) a body
    # split removed a representative and only body-counting arms noticed. If the rep carrying the
    # ONLY gate with a case arm is dropped or re-pointed, every cell becomes `arm3:not-in-gate`,
    # the axis quadruples the population and measures nothing, and no other arm in this file says
    # so — arm3 and arm1b both stay satisfied because they compare reps to cells, not to ARM3_GATE.
    if ARM3_GATE not in {r[1] for r in reps_flat}:
        f.append('arm8: the arm-3 gate `%s` has NO representative among the declared REPS — the '
                 'caseReach axis then labels every cell `arm3:not-in-gate` and multiplies the '
                 'population by %d for nothing' % (ARM3_GATE, len(REACH_PROPERTIES)))

    # ⭐⭐ arm9 — THE PREMISE OF THE GATE-SCOPED caseReach RULE, READ FROM THE ENFORCEMENT MANIFEST
    # RATHER THAN BELIEVED. The rule deletes three of every four cells for every representative
    # except one, on the claim that only that one's gate has a case arm. ⛔ A claim a generator
    # makes about itself is not a detector: ARM3_GATE is a static name in this file, and the
    # `arm3:not-in-gate` label the deleted cells used to carry was computed from that SAME static
    # name — which is precisely why the unconditional sweep pre-paid nothing. This arm is the
    # difference: it resolves the claim against `permissions[<code>].legacyEquivalence.openArms`,
    # the manifest field that states which gates have which arms, on EVERY run.
    # ⚠ IT FIRES IN BOTH DIRECTIONS, and both are real. A SECOND case-armed rep means the rule is
    # now deleting live coordinates (the AE4.9 / ADR 0201 D5 rep-loss shape, one layer over);
    # ZERO means the axis is sweeping a gate that no longer has the arm it exists to measure.
    if permissions is None:
        f.append('arm9: the enforcement manifest could not be read (%s) — the gate-scoped '
                 'caseReach rule\'s premise is then UNVERIFIED, and an unverified premise deleting '
                 '3 of every 4 cells for 4 of 5 reps is an unreasoned exclusion with a reason '
                 'attached' % (_MANIFEST_ERR or 'not supplied'))
    else:
        _absent_reps = sorted({r[0] for r in reps_flat} - set(permissions))
        if _absent_reps:
            f.append('arm9: representative(s) %s are absent from the enforcement manifest — their '
                     '`openArms` cannot be read, so there is no authority for deleting the '
                     'caseReach coordinate from them' % ', '.join(_absent_reps))
        else:
            _armed = {klass for code, klass, _res in reps_flat
                      if ARM3_CASE_ARM_FN in
                      ((permissions[code].get('legacyEquivalence') or {}).get('openArms') or [])}
            if _armed != {ARM3_GATE}:
                f.append('arm9: the enforcement manifest says the case-armed representative gate(s) '
                         'are %s — the gate-scoped caseReach rule assumes exactly {%s}. If the arm '
                         'MOVED OR SPREAD, the rule is deleting a live coordinate; if it VANISHED, '
                         'the axis measures nothing. Re-rule CONDITIONAL_EXCLUSIONS[(\'caseReach\', '
                         '\'inert_outside_the_arm3_gate\')] — its STANDING CONDITION names exactly '
                         'this event — before regenerating.'
                         % (sorted(_armed) or ['(none — no rep\'s openArms names %s)' % ARM3_CASE_ARM_FN],
                            ARM3_GATE))

    # ⭐⭐ arm14 — THE PROBE DECLARATION IS HELD TO THE MATRIX, AND THE CELLS TO THE
    # DECLARATION (L9′ / L10). Three independently-firable halves.
    # (a) Every staff representative must DECLARE a probe, or its legacy column is empty and the
    #     suite silently has nothing to execute — a coverage loss with no number.
    # (b) The keying this file DERIVES from the probe must equal the keying matrix § 5.4's
    #     per-site `subject` implies. These are two independent readings of one fact; letting them
    #     drift is how the declared door came to disagree with the live one in the first place.
    # (c) Every emitted cell's `legacy_fixture_id` must be the one the declaration resolves for its
    #     (code, persona, gate) — the half that refuses a hand-repointed binding.
    _staff_codes = sorted({c[4] for c in cells if c[14] == 'staff'})
    _noprobe = [x for x in _staff_codes if probe_for(x) is None]
    if _noprobe:
        f.append('arm14: representative(s) %s declare no executable probe — 424 executes '
                 '`legacy_sql` verbatim, so a row without one contributes an EMPTY legacy column '
                 'and its cells assert nothing. Declare `arm3Door.probe` (or `legacyProbe`).'
                 % ', '.join('`%s`' % x for x in _noprobe))
    # ⚠⚠ arm14(b)'s DOMAIN IS THE ELEVEN arm3Door ROWS, AND THE BOUND IS STATED BECAUSE THE
    # FIRST CUT GOT IT WRONG — it compared every row and FIRED ON THE REAL SPEC, which is the
    # discrimination control doing its job on its author. § 5.4's `subject` describes the
    # PRODUCTION SITE; a probe's keying describes what the DIFFERENTIAL can ask. For a row with an
    # arm-3 door those are the same question and must agree. For the nine BARE rows they are NOT:
    # the production site is a bare `app.is_member_of(scope)` reading `auth.uid()` (§ 5.4:
    # `caller`), while the differential deliberately probes the `_for` variant, which accepts a
    # principal — that is ADR 0201 D1's asymmetry, not a drift. ⛔ Those rows are OUT of this
    # arm's domain and COUNTED in the census below, never silently exempted: an escape hatch for
    # the genuinely-different also silences the merely-wrong.
    _perms = permissions or {}
    _doorrows = [x for x in _staff_codes
                 if ((_perms.get(x) or {}).get('arm3Door') or {}).get('probe')]
    # ⚠ A ROW MAY OVERRIDE ITS DERIVED KEYING, BUT ONLY BY DECLARING A RULING AND A REASON, and
    # the overrides are PRINTED rather than merely skipped — an exemption nobody can see is how a
    # weakened arm looks from the outside. Row 16 carries one (L11): it has a `p_uid` door but is
    # probed through the policy leg, because the two production doors disagree on the inactive
    # principal that P1 is about.
    _overridden = sorted(x for x in _doorrows
                         if (probe_for(x, _perms) or {}).get('keyingOverride'))
    if _overridden:
        _KEYING_CENSUS.extend('%s (override: %s)'
                              % (x, (probe_for(x, _perms) or {})['keyingOverride'].get('ruling'))
                              for x in _overridden)
    _keymismatch = [(x, row_keying(x, _perms), subject_keying(x, _perms))
                    for x in _doorrows if x not in set(_overridden)
                    and subject_keying(x, _perms) is not None
                    and row_keying(x, _perms) != subject_keying(x, _perms)]
    if _keymismatch:
        f.append('arm14: %d arm-3 door representative(s) derive a keying from their PROBE that '
                 'disagrees with the keying matrix § 5.4\'s per-site `subject` implies (first: '
                 '`%s` probe=%s vs § 5.4=%s) — for a row WITH a door these are one question, so a '
                 'disagreement means the probe is reading a different door from the one the '
                 'matrix swept' % (len(_keymismatch), _keymismatch[0][0],
                                   _keymismatch[0][1], _keymismatch[0][2]))
    _bare_divergent = sorted(x for x in _staff_codes if x not in _doorrows
                             and subject_keying(x, _perms) is not None
                             and row_keying(x, _perms) != subject_keying(x, _perms))
    if _bare_divergent:
        _KEYING_CENSUS.extend(_bare_divergent)
    # ⭐ (d) EVERY BOUND ID MUST BE A FIXED LITERAL IN seed.sql OR A MIGRATION. An id read out
    # of the catalog at generation time is a value that changes on the next reset, and the probe
    # then silently measures a row that does not exist.
    # ⛔ SCANNED ON THE DECLARATION, NOT ONLY ON THE CELLS. The declaration is where a bad id
    # ENTERS; checking only emitted cells would pass a manifest whose binding is unusable for a
    # coordinate this run happened not to emit, and the next axis change would surface it as a
    # mystery red. Emitted ids are checked too, since a hand edit bypasses the declaration.
    _declared_ids = set()
    for _c, _row in (permissions or {}).items():
        if _c.startswith('_'):
            continue
        _pr = (_row.get('arm3Door') or {}).get('probe') or _row.get('legacyProbe')
        for _v in ((_pr or {}).get('fixtures') or {}).values():
            for _x in (_v.values() if isinstance(_v, dict) else [_v]):
                if isinstance(_x, str) and _x != '{uid}' and _x.count('-') == 4:
                    _declared_ids.add(_x)
    # ⭐ (f) NO RESOURCE FIXTURE MAY BE A PERSONA-AXIS ID. Row 4's `disjunct_absent` bound
    # `gap.unpriv`, which is also the third-party CALLER, so the subject was the caller on every
    # third-party cell and the door's self leg fired — a fabricated grant in one direction and a
    # stuck deny in the other, which is the fixture-shared-ids shape exactly.
    _persona_ids = {str(v).lower() for v in ((_fixtures().get('personaUid') or {}).values())}
    _persona_ids.add(str(_fixtures().get('thirdPartyCaller') or '').lower())
    _collide = sorted({c[19] for c in cells
                       if c[19] and c[19].lower() in _persona_ids
                       and (probe_for(c[4]) or {}).get('kind') == 'rls-select'
                       and _resolved_fixture(c[4], c[1], c[15], c[3]) != principal_uid(c[1])})
    if _collide:
        f.append('arm14: %d resource fixture id(s) are also PERSONA-AXIS ids (first: %s) — a '
                 'fixture that doubles as a persona makes the probe read the caller\'s own row, '
                 'which fabricates a grant for that persona and leaves the real predicate '
                 'unexercised for every other one' % (len(_collide), _collide[0]))
    # ⭐ (g) A `personas` REACH MUST BE SCOPE-KEYED. The fixtures are; a persona-only reach names
    # one principal for every scope and lies wherever the resource moved.
    _flatreach = sorted({x for x in _staff_codes
                         if (arm3_limb_b_reach(x, _perms) or {}).get('kind') == 'personas'
                         and (arm3_limb_b_reach(x, _perms) or {}).get('byScope') is None})
    if _flatreach:
        f.append('arm14: representative(s) %s declare a `personas` reach with no `byScope` — the '
                 'resource fixtures are scope-keyed, so the principal limb (b) fires for differs '
                 'per scope and a flat list is wrong everywhere but one'
                 % ', '.join('`%s`' % x for x in _flatreach))
    # ⭐ (h) THE BOUND FUNCTION MUST BE THE ROW'S DECLARED DOOR. Row 12 was approximated with
    # `app.can_read_case_committee` — a READ predicate with a different signature from the write
    # guard the matrix cites — and measured false for every persona, so 4 cells asserted nothing
    # about the door they name. ⛔ The bound name must appear in the row's own `arm3Door`
    # declaration (its expression or one of its § 5.4 sites); a neighbouring predicate is a
    # DIFFERENT test wearing the row's name.
    import re as _re
    _wrongdoor = []
    for _x in _staff_codes:
        _d = (_perms.get(_x) or {}).get('arm3Door') or {}
        _pr = _d.get('probe')
        if not _pr or _pr.get('kind') != 'function-call':
            continue
        _mm = _re.match(r'([a-z_]+\.[a-z_]+)\(', _pr.get('call') or '')
        _fn = _mm.group(1) if _mm else ''
        # ⭐ EITHER SURFACE (L21), for subject_keying's reason: a re-keyed row's sites live in
        # `enforcementSites`, and reading only `armInterface` left this scan with an EMPTY site
        # list for all 20 AE5 rows — it then fell back to `arm3Door.expression` alone and
        # stopped being a cross-check at the moment it had two surfaces to cross.
        _row_x = _perms.get(_x) if isinstance(_perms.get(_x), dict) else {}
        _sites = ([str(a.get('site', '')).split(' ')[0] for a in (_row_x.get('armInterface') or [])]
                  + [(e['schema'] + '.' + e['name']) for e in (_row_x.get('enforcementSites') or [])])
        if not _fn or (_fn not in (_d.get('expression') or '') and _fn not in _sites):
            _wrongdoor.append((_x, _fn))
    if _wrongdoor:
        f.append('arm14: %d representative(s) bind a function that is NOT the row\'s declared '
                 'door (first: `%s` binds `%s`, which appears in neither its `arm3Door.expression` '
                 'nor its § 5.4 sites) — a neighbouring predicate is a different test wearing the '
                 'row\'s name, and it answers for the wrong door in silence'
                 % (len(_wrongdoor), _wrongdoor[0][0], _wrongdoor[0][1] or '(unparsed)'))
    # ⭐⭐ (i) A P1-LABELLED CLASS MUST NOT BIND A STATE-GATED FUNCTION DOOR. P1's approved
    # divergence is exactly "the role-free disjunct IGNORES principal state"; a function that
    # opens with `if not app.is_active(p_uid) then return false` DENIES the cells the label
    # approves, so the probe and the label contradict each other. Measured twice, on rows 11 and
    # 16, for 40 cells between them before it was caught. ⛔ Keyed on the DECLARED, measured flag
    # (the smoke re-reads each body and reds if the flag goes stale) because this gate cannot
    # open a database.
    _p1lab = 'arm3:divergent-approved:role-free-disjunct-ignores-principal-state'
    _p1labelled = {c[4] for c in cells if c[12] == _p1lab}
    _gatedp1 = sorted(x for x in _p1labelled
                      if (probe_for(x, _perms) or {}).get('kind') == 'function-call'
                      and (probe_for(x, _perms) or {}).get('probeStateGated'))
    if _gatedp1:
        f.append('arm14: representative(s) %s carry the approved limb-(b) divergence while '
                 'binding a STATE-GATED function door — P1 approves a disjunct that ignores '
                 'principal state, and a door gating on `app.is_active` denies precisely those '
                 'cells, so the probe contradicts the label it is measured against. Probe the '
                 'POLICY leg P1 was ruled on.' % ', '.join('`%s`' % x for x in _gatedp1))
    _noreadtable = sorted({x for x in _staff_codes
                           if _needs_resource(x) and not probe_reads(x, _perms)[0]})
    if _noreadtable:
        f.append('arm14: representative(s) %s bind a RESOURCE but declare no `probeReadsTable` — '
                 'the presence check would then look in whatever table the fixture is NAMED '
                 'after, and row 16 is the measured proof those differ: `can_read_document` '
                 'reads `public.documents` while its ids were `controlled_documents` ones, so '
                 'the door denied everyone and the check stayed green'
                 % ', '.join('`%s`' % x for x in _noreadtable))
    _nonliteral = sorted({x for x in _declared_ids | {c[19] for c in cells if c[19]}
                          if x.lower() not in seeded_literals()})
    if _nonliteral:
        f.append('arm14: %d bound fixture id(s) do not appear as a FIXED LITERAL in seed.sql or '
                 'any migration (first: %s) — an id resolved from the catalog at generation time '
                 'changes on the next reset, and a probe against a row that no longer exists '
                 'returns FALSE, which is indistinguishable from a door that denies'
                 % (len(_nonliteral), _nonliteral[0]))
    _badbind = [c for c in cells
                if c[14] == 'staff'
                and c[19] != str(_resolved_fixture(c[4], c[1], c[15], c[3]) or '')]
    if _badbind:
        f.append('arm14: %d cell(s) carry a `legacy_fixture_id` the declaration does not resolve '
                 'for their (code, persona, gate arm) — the binding table is the manifest\'s, and '
                 'a cell that names a different row probes a resource nobody ruled (first: %s)'
                 % (len(_badbind), _badbind[0][0]))

    # ⭐⭐ arm13 — LIMB (b)'s REACH IS THE MANIFEST'S CLAIM, AND THE CELLS ARE HELD TO
    # IT. Two independently-firable halves, neither of which re-derives the label.
    # (a) A row that sweeps `disjunct_present` must DECLARE a reach. Without this the generator
    #     would silently label nothing on an undeclared row — a coordinate declared by the
    #     matrix and answered by no cell, which is the exact shape L6 found in `armInterface`.
    # (b) Every P1-labelled cell must sit where the declared reach says limb (b) can fire. This is
    #     the half that would have caught the first cut: it refuses a flip on a persona the
    #     fixture cannot make true.
    _p1 = 'arm3:divergent-approved:role-free-disjunct-ignores-principal-state'
    _gate_rows = sorted({c[4] for c in cells if c[15] == 'disjunct_present'})
    _undeclared = [x for x in _gate_rows if arm3_limb_b_reach(x) is None]
    if _undeclared:
        f.append('arm13: representative(s) %s sweep `disjunct_present` but their `arm3Door` '
                 'declares no `reach` — limb (b)\'s reach is the MATRIX\'s claim about which '
                 'principals the disjunct can fire for, and without it this generator would have '
                 'to hard-code a persona list, which is a claim it cannot make about itself. '
                 'Declare `arm3Door.reach` (kind: unconditional | personas | selfcheck).'
                 % ', '.join('`%s`' % x for x in _undeclared))
    # ⚠ THE CELL'S SCOPE IS PART OF THE PREDICATE since the reach became scope-keyed; omitting
    # it made every byScope row read as unreachable and this arm fired on 56 correct cells.
    _overreach = [c for c in cells
                  if c[12] == _p1 and not limb_b_fires(c[4], c[1], c[8], c[3], _perms)]
    if _overreach:
        f.append('arm13: %d cell(s) carry the approved limb-(b) divergence on a coordinate where '
                 'the DECLARED reach says the disjunct cannot fire — the legacy door denies '
                 'there, so the cell is not divergent and `expected_legacy_granted = true` is an '
                 'approval of something that never happens (first: %s)'
                 % (len(_overreach), _overreach[0][0]))

    # ⭐⭐ arm10 — THE SECOND EXPECTED VALUE, HELD TO THE SAME BAR AS THE FIRST.
    # `expected_legacy_granted` carries PO ruling R2 into the vector, and the ruling has two
    # halves that a single careless edit can merge: classes 3 and 4 are APPROVED reach, class 5
    # is a FILED DEFECT. Three sub-checks, each independently firable (the --self-test fixtures
    # below exercise them one at a time), and NONE of them re-derives the value — they assert
    # the ruling against the label the derivation already transcribed.
    # ⚠ There is deliberately NO "this column is a copy of expected_granted" check: a
    # divergent-approved cell always has expected_granted = False (arm3_divergence returns
    # `arm3:masking` first whenever it is True), so (a) refuses the copy shape already, and a
    # fourth sub-check that could never fire alone would be a detector nobody has shown finds
    # anything — the shape this whole file exists to refuse.
    _demoted = [c for c in cells if c[12] in ARM3_DIVERGENT_APPROVED and not c[13]]
    if _demoted:
        f.append('arm10: %d cell(s) labelled PO-APPROVED divergent reach expect the legacy door '
                 'to DENY — R2 ruled the case-grant path approved designed reach ("that is the '
                 'whole point of an explicit grant"), so a deny expectation here silently revokes '
                 'it and 403 would pin the narrowing as correct (first: %s)'
                 % (len(_demoted), _demoted[0][0]))
    # ⭐ KEYED ON THE `arm3:divergent-defective:` FAMILY SINCE ADR 0209, not on one label. The one
    # member is FIXED and labels ZERO cells, so a name-keyed arm would be a detector with nothing
    # to detect — and the next hand would delete it as dead. The family keeps it live for the NEXT
    # filed defect, and --self-test synthesises a member so the arm is still exercised today.
    _approved_defect = [c for c in cells if c[12].startswith(ARM3_DEFECT_PREFIX) and c[13]]
    if _approved_defect:
        f.append('arm10: %d cell(s) carrying a `%s` label expect the legacy door to GRANT — that '
                 'encodes a FILED DEFECT\'s current behaviour as the approved answer, which is the '
                 'ONE thing R2 forbids. A defect is carried as a head-on assertion in 403 § 7 '
                 'plus, while it stands, a carve-out — never as an expected value (first: %s)'
                 % (len(_approved_defect), ARM3_DEFECT_PREFIX, _approved_defect[0][0]))
    # ⭐ (d) THE NARROWER LABEL'S OWN CONTRADICTION. (a)/(b)/(c) all assume the WIDE
    # direction, so none of them can see a narrower-labelled cell that expects a legacy GRANT.
    # ⛔ The real vector carries ZERO such cells by construction, so --self-test SYNTHESISES
    # one: a selection-based fixture would have nothing to select, exactly as for the defective
    # family.
    _narrower_granting = [c for c in cells if c[12] == ARM3_NARROWER_CONJUNCT_UNMET and c[13]]
    if _narrower_granting:
        f.append('arm10: (d) %d cell(s) labelled `%s` expect the legacy door to GRANT — the '
                 'label means the door DENIES on its own conjunct, so a granting expectation '
                 'there is the label contradicting itself (first: %s)'
                 % (len(_narrower_granting), ARM3_NARROWER_CONJUNCT_UNMET,
                    _narrower_granting[0][0]))
    # ⚠ (c) MUST EXEMPT THE NARROWER FAMILY OR EVERY ONE OF ITS CELLS READS AS AN
    # UNATTRIBUTED FLIP: they flip by design, and the label IS the attribution.
    _unattributed = [c for c in cells
                     if c[13] != c[9] and c[12] not in ARM3_DIVERGENT_APPROVED
                     and c[12] != ARM3_NARROWER_CONJUNCT_UNMET
                     and not c[12].startswith(ARM3_DEFECT_PREFIX)]
    if _unattributed:
        f.append('arm10: %d cell(s) expect the legacy door to disagree with the matrix WITHOUT a '
                 'divergent label to attribute it to — 403 §4.1 excuses legacy-vs-catalog '
                 'disagreement on exactly these cells, so an unattributed flip is an exemption '
                 'nobody ruled (first: %s)' % (len(_unattributed), _unattributed[0][0]))

    # ⭐⭐ arm12 — THE PREMISE OF THE GATE-SCOPED memberGateArm RULE, READ FROM THE MANIFEST.
    # The rule deletes every value this file does not declare for a representative, on the claim
    # that the row carries those coordinates and no others. ⛔ That claim is the MATRIX's (§ 5.3,
    # PO-approved), recorded in the enforcement manifest as `memberGateArm` beside the `arm3Door`
    # that says what the legacy column calls — it is not this file's to assert. arm12 resolves the
    # two against each other on EVERY run, in BOTH directions, which is what turns "the reps and
    # the manifest agree" from a hope into a gate. Modelled on arm9 deliberately: same shape, same
    # failure mode, one axis over.
    if permissions is None:
        f.append('arm12: the enforcement manifest could not be read (%s) — the gate-scoped '
                 'memberGateArm rule\'s premise is then UNVERIFIED, and an unverified premise '
                 'deleting cells is an unreasoned exclusion with a reason attached'
                 % (_MANIFEST_ERR or 'not supplied'))
    else:
        for _code in sorted({r[0] for r in reps_flat}):
            _row = permissions.get(_code) or {}
            _vals = _row.get('memberGateArm')
            _door = _row.get('arm3Door')
            _carries = bool(_vals) and _vals != [MEMBER_GATE_INERT]
            if _carries and not _door:
                f.append('arm12: representative `%s` declares memberGateArm values %s but NO '
                         '`arm3Door` — the axis would be swept with nothing for the differential\'s '
                         'legacy column to call, which is a vector column no assertion reads '
                         '(lead ruling L2)' % (_code, _vals))
            if _door and not _carries:
                f.append('arm12: representative `%s` declares an `arm3Door` but no memberGateArm '
                         'values beyond the inert one — the door is named and never exercised, so '
                         'the declaration is decorative' % _code)
            _lc = (_door or {}).get('legacyClass')
            if _door and not _lc:
                f.append('arm12: representative `%s`\'s `arm3Door` carries no `legacyClass` — '
                         'the vector and the suite would each pick their own name for the same row, '
                         'which is the synonym drift one-name-per-row exists to stop' % _code)
            elif _lc and _lc not in {r[1] for r in reps_flat if r[0] == _code}:
                f.append('arm12: representative `%s` is swept as legacy class `%s` but its '
                         '`arm3Door.legacyClass` says `%s` — the vector column and the manifest '
                         'disagree about the row\'s ONE name'
                         % (_code, sorted({r[1] for r in reps_flat if r[0] == _code}), _lc))
            if _door and not _door.get('expression'):
                f.append('arm12: representative `%s`\'s `arm3Door` carries no `expression` — 424 '
                         'has nothing to build its legacy side from' % _code)
    _emitted_gates = {c[15] for c in cells}
    _declared_gates = set()
    if permissions is not None:
        for _code in {r[0] for r in reps_flat}:
            _declared_gates |= set((permissions.get(_code) or {}).get('memberGateArm') or [])
    _lost = sorted(_declared_gates - _emitted_gates)
    if _lost:
        f.append('arm12: memberGateArm value(s) %s are DECLARED on a representative and appear in '
                 'NO cell — the coordinate the matrix approved is not being measured'
                 % ', '.join(_lost))

    # ⚠ SAME NARROW EXEMPTION AS arm3's, and keyed the same way: a rep whose door is declared
    # `not-executable` emits nothing BY RULE and is counted in the skip census with its reason.
    # ⛔ Keyed on the DECLARATION, never on a code name — a hand-list would silence the next
    # genuinely-dropped rep, which is the one thing this arm is for.
    declared = {r[0] for r in reps_flat
                if (probe_for(r[0], permissions) or {}).get('kind') != 'not-executable'}
    emitted = {c[4] for c in cells}
    if declared - emitted:
        f.append('arm1b: representative(s) declared but never emitted: %s' % ', '.join(sorted(declared - emitted)))
    return f


if '--self-test' in sys.argv:
    base_cells = cells; base_skipped = skipped
    ax = spec['axes']
    # arm7 needs axis fixtures, not cell fixtures — the whole point is that it sees a value
    # the CELLS cannot show you. Two shapes: a declared value nobody emits or excuses, and an
    # axis with no disposition at all.
    ax_extra_value = json.loads(json.dumps(ax))
    ax_extra_value['scope']['values']['a_ninth_scope'] = 'declared, never enumerated, never excused'
    ax_extra_axis = json.loads(json.dumps(ax))
    ax_extra_axis['aNewAxisNobodyDisposed'] = {'values': {'x': 'y'}}
    _RENAMED = 'a_gate_with_no_case_arm'
    # ⛔ A DICT, like every other fixture's reps, since AE5 increment 1 made coverage() role-keyed.
    _repointed_reps = {r: [(x[0], _RENAMED if x[1] == ARM3_GATE else x[1], x[2]) for x in v]
                       for r, v in REPS_BY_ROLE.items()}
    _repointed_cells = [(c[:5] + (_RENAMED,) + c[6:]) if c[5] == ARM3_GATE else c
                        for c in base_cells]
    # ⛔ arm9's FIXTURES PERTURB THE MANIFEST AND NOTHING ELSE — not the cells, not the reps. That
    # is what isolates the arm: no other arm in this file reads `permissions`, so a fixture here
    # cannot be caught by a neighbour and reported under the wrong name (the lesson arm1b's
    # isolation note records). ⚠ `_repointed_reps` above is the MIRROR of these and must NOT be
    # reused for them: it renames the class, which arm8c sees; these leave REPS alone and move the
    # AUTHORITY, which is the event the standing condition is actually about.
    _pm = MANIFEST_PERMISSIONS or {}

    def _pm_with_arms(code, arms):
        d = json.loads(json.dumps(_pm))
        d.setdefault(code, {}).setdefault('legacyEquivalence', {})['openArms'] = arms
        return d
    # A SECOND rep grows the case arm — the event the standing condition names in terms.
    _pm_two_armed = _pm_with_arms('org.case_vocabulary.manage', [ARM3_CASE_ARM_FN])
    # The arm-3 rep LOSES it — the axis would then sweep a gate with nothing to measure.
    _pm_disarmed = _pm_with_arms(ARM3_REP_CODE, ['app.is_admin_for', 'authz.has_permission'])
    # The rep is not in the manifest at all — no authority either way, which is not a pass.
    _pm_rep_absent = {k: v for k, v in _pm.items() if k != ARM3_REP_CODE}
    def _one(labels, value):
        """base_cells with expected_legacy_granted set to `value` on the first cell whose
           arm3_divergence is in `labels` AND whose current value DIFFERS from `value`.
           ⛔ THE SECOND CONJUNCT IS NOT TIDINESS — it is the whole fixture. Written as "the first
           cell carrying the label", this picked a `caps-deny` cell that already expected a legacy
           GRANT, rewrote it to the value it already had, and reported NOT CAUGHT: a fixture that
           perturbs nothing reads as a broken ARM. Asserts a candidate exists, so the day no cell
           can be perturbed the --self-test dies loudly instead of passing an empty mutation."""
        out = list(base_cells)
        i = next((j for j, c in enumerate(out) if c[12] in labels and c[13] != value), None)
        assert i is not None, ('no cell carries any of %s with expected_legacy_granted != %s — '
                               'the arm10 fixture would perturb nothing' % (labels, value))
        # ⛔ THE TAIL IS PRESERVED, NOT TRUNCATED. Before AE5 increment 1 the tuple ended at
        # index 13 and `[:13] + (value,)` was a whole rewrite; it now drops the `role` column and
        # the fixture dies in coverage() instead of exercising arm10.
        out[i] = out[i][:13] + (value,) + out[i][14:]
        return out

    def _synth_defect():
        """base_cells with ONE cell RE-LABELLED into the `arm3:divergent-defective:` family AND
           given an approved legacy GRANT — the exact shape arm10(b) exists to refuse.

           ⛔⛔ SYNTHESISED, NOT SELECTED, AND THAT IS THE POINT SINCE ADR 0209 (lead ruling R-L3).
           The family is EMPTY in the real vector now that the filed defect is fixed, so the
           `_one((ARM3_PINNED_DEFECT,), True)` fixture this replaces would raise its "no candidate"
           assertion and the obvious repair would be to DELETE the fixture — disarming the only arm
           that refuses a future filed defect laundered into an approved legacy GRANT, on the very
           day the last one was fixed. Synthesising keeps the detector armed against a defect
           nobody has filed yet.
           ⭐ THE DISCRIMINATION HALF IS THE REAL-SPEC RUN AT THE END OF --self-test: this fixture
           proves arm10(b) is LOUD on a defective-labelled GRANT, and that run proves it is QUIET
           on the real cell set. One without the other is half a control."""
        out = list(base_cells)
        i = next((j for j, c in enumerate(out) if not c[12].startswith(ARM3_DEFECT_PREFIX)), None)
        assert i is not None, ('every cell already carries a defective label — the synthesised '
                               'arm10(b) fixture would perturb nothing')
        # ⛔ TAIL PRESERVED — see _one. Columns 14+ (`role`) must survive the synthesis.
        out[i] = out[i][:12] + (ARM3_PINNED_DEFECT, True) + out[i][14:]
        return out

    def _synth_narrower():
        """base_cells with ONE cell RE-LABELLED into the narrower family AND given a legacy
           GRANT — the exact shape arm10(d) exists to refuse.

           ⛔⛔ SYNTHESISED, NOT SELECTED, for _synth_defect's reason one step further
           on: every real narrower-labelled cell expects a legacy DENY, because expected_legacy()
           returns False for the label unconditionally. So there is NO cell to select that would
           exercise (d), and a selection fixture would raise "no candidate" — whereupon the
           obvious repair is to delete the fixture and disarm the only arm that refuses a
           narrower label laundered into a GRANT.
           ⭐ DISCRIMINATION HALF: the real-spec run at the end of --self-test proves (d) is
           QUIET on the true cell set; this proves it is LOUD. One without the other is half a
           control."""
        out = list(base_cells)
        i = next((j for j, c in enumerate(out) if c[12] != ARM3_NARROWER_CONJUNCT_UNMET), None)
        assert i is not None, ('every cell already carries the narrower label — the synthesised '
                               'arm10(d) fixture would perturb nothing')
        # ⛔ TAIL PRESERVED — see _one. Columns 14+ (`role`, `gate`) must survive.
        out[i] = out[i][:12] + (ARM3_NARROWER_CONJUNCT_UNMET, True) + out[i][14:]
        return out

    def _synth_overreach():
        """base_cells with ONE `disjunct_present` cell on an UNREACHABLE coordinate re-labelled
           into the approved limb-(b) family and given a legacy GRANT — exactly the mistake
           the first cut of the P1 branch made 430 times.

           ⛔⛔ SYNTHESISED, NOT SELECTED, and for the strongest form of the reason:
           the derivation now computes the label FROM the declared reach, so no real cell can be
           in this state and a selection fixture would have nothing to select. That is precisely
           why the arm still has to exist — a hand editing the vector, or a reach declaration
           narrowed without regenerating, puts cells here immediately.
           ⭐ DISCRIMINATION HALF: the real-spec run at the end of --self-test proves arm13 is
           QUIET on the true cell set; this proves it is LOUD."""
        out = list(base_cells)
        i = next((j for j, c in enumerate(out)
                  if c[15] == 'disjunct_present'
                  and limb_b_fires(c[4], c[1], c[8], c[3]) is False), None)
        assert i is not None, ('no cell sits at `disjunct_present` on an unreachable coordinate — '
                               'the synthesised arm13 fixture would perturb nothing')
        # ⛔ TAIL PRESERVED — see _one. Columns 14+ (`role`, `gate`, door) must survive.
        out[i] = out[i][:12] + ('arm3:divergent-approved:role-free-disjunct-ignores-principal-state', True) + out[i][14:]
        return out

    def _synth_badbind():
        """base_cells with ONE cell's `legacy_fixture_id` repointed at another arm's row — a
           binding the declaration does not resolve. ⛔ Synthesised: the emitter derives the
           column from the same declaration arm14(c) checks, so no real cell can be in this state,
           which is exactly why a hand edit to the vector has to be refused."""
        out = list(base_cells)
        i = next((j for j, c in enumerate(out) if c[14] == 'staff' and c[19]), None)
        assert i is not None, ('no staff cell carries a fixture id — the synthesised arm14(c) '
                               'fixture would perturb nothing')
        out[i] = out[i][:19] + ('00000000-0000-0000-0000-0000000000ff',) + out[i][20:]
        return out

    def _pm_random_id(pm):
        """A fixture id replaced by one that appears in NO seed file - the `gen_random_uuid()`
           shape. arm14(d) must name it; the emitter cannot, because a uuid read from the catalog
           looks exactly like a uuid written in seed.sql."""
        for code, row in pm.items():
            pr = (row.get('arm3Door') or {}).get('probe')
            if pr and pr.get('fixtures'):
                for arm, v in pr['fixtures'].items():
                    if isinstance(v, dict) and 'own_commission' in v:
                        v['own_commission'] = 'ac3f1301-49e3-4b2b-b904-6a2a4fea8cfc'
                        return

    def _synth_crossscope():
        """ONE cell at a non-own scope rebound to the OWN-scope resource - a real, literal,
           seeded id, just the wrong commission. ⛔ This is the defect that made 458 of 572 cells
           red: `legacy_sql` measured CCIH while `catalog_sql` asked about Farmácia, so the two
           sides answered about different resources and the cell's name described neither.
           ⚠ The planted id is LITERAL on purpose, so arm14(d) stays quiet and (c) is shown to
           fire on its own predicate rather than on a malformed value."""
        out = list(base_cells)
        i = next((j for j, c in enumerate(out)
                  if c[14] == 'staff' and c[3] != 'own_commission' and c[19]
                  and _resolved_fixture(c[4], c[1], c[15], 'own_commission')
                  and _resolved_fixture(c[4], c[1], c[15], 'own_commission') != c[19]), None)
        assert i is not None, ('no off-own cell differs from its own-scope binding - the '
                               'synthesised arm14 cross-scope fixture would perturb nothing')
        own = _resolved_fixture(out[i][4], out[i][1], out[i][15], 'own_commission')
        out[i] = out[i][:19] + (str(own),) + out[i][20:]
        return out

    def _synth_personacollide():
        """ONE rls-select cell's `legacy_fixture_id` repointed at a PERSONA-AXIS id - row 4's
           measured defect, where the `disjunct_absent` subject was also the third-party caller.
           arm14(f) must name it."""
        out = list(base_cells)
        tgt = str((_fixtures().get('thirdPartyCaller') or '')).lower()
        i = next((j for j, c in enumerate(out)
                  if c[14] == 'staff' and c[19]
                  and (probe_for(c[4]) or {}).get('kind') == 'rls-select'
                  and c[1] != 'unprivileged'), None)
        assert i is not None, ('no rls-select staff cell to repoint - the synthesised arm14(f) '
                               'fixture would perturb nothing')
        out[i] = out[i][:19] + (tgt,) + out[i][20:]
        return out

    def _pm_gated_p1(pm):
        """A P1-carrying class re-pointed at a STATE-GATED function door - rows 11 and 16's
           measured defect, where the probe denied exactly the cells the label approves."""
        # targets row 11 by NAME here only because the function must genuinely be THAT row's
        # declared door - otherwise arm14(h) claims the fixture and the state-gate arm stays
        # unexercised, which is the neighbouring-arm trap one level down
        for code, row in pm.items():
            if code != 'commission.action_items.read':
                continue
            d = row.get('arm3Door') or {}
            if (d.get('reach') or {}) and (d.get('probe') or {}).get('kind') == 'rls-select':
                d['probe'] = dict(d['probe'])
                d['probe']['kind'] = 'function-call'
                # the call binds auth.uid(), NOT the principal, so `row_keying` stays caller-only and
                # the keying sub-check cannot fire - this fixture must isolate the STATE-GATE arm
                d['probe']['call'] = 'app.can_read_action_item({resource}::uuid, auth.uid())'
                d['probe']['probeStateGated'] = True
                return

    def _pm_flat_reach(pm):
        """A scope-keyed reach flattened back to a persona list - the shape that flipped 40 cells
           at scopes where the named principal is not the assignee. arm14(g) must name it."""
        for code, row in _manifest_rows(pm):
            r = (row.get('arm3Door') or {}).get('reach')
            if r and r.get('byScope'):
                r['personas'] = sorted({p for v in r['byScope'].values() for p in v})
                del r['byScope']
                return

    def _flip_keying(pm):
        """A CALLER-ONLY row's probe rewritten to pass the cell's principal - fabricating a
           third-party capability the production site does not have. arm14(b) must name it.

           ⛔⛔ REFUSES BY NAME WHEN THERE IS NO SUBJECT (lead ruling L21). This helper used to
           scan to the end and fall off into `permissions`' `_*_note` keys, reporting an empty
           subject population as `'str' object has no attribute 'get'`. Two different failures
           wore one stack trace: a genuine shape change, and "no row is caller-only any more",
           which is not a crash but a VOID FIXTURE — the mutation cannot be built, so arm14(b)
           is asserted against nothing. A fixture that cannot be constructed must say so in its
           own words, or the arm it feeds reports green for the wrong reason."""
        for code, row in _manifest_rows(pm):
            pr = (row.get('arm3Door') or {}).get('probe')
            if pr and subject_keying(code, pm) == 'caller-only' and '{uid}' not in (pr.get('call') or ''):
                pr['kind'] = 'function-call'
                pr['call'] = 'app.is_member_of_for({scope}::uuid, {uid}::uuid)'
                return
        raise SystemExit(
            'gen-authz-differential-cells: arm14(b) has NO SUBJECT — not one manifest row reads '
            'as `caller-only`, so the keying-flip fixture cannot be built and arm14(b) would be '
            'asserted against an empty mutation. ⛔ This is a VOID CONTROL, not a passing one. '
            'The cause is almost always that `subject`/`hat` are missing from the surface the '
            'rows now declare (enforcementSites once a row re-keys, armInterface while it is '
            'pending) — see fieldContracts.siteHats and lead ruling L21.')

    def _synth_badkeying():
        """The MANIFEST perturbed so a `caller-only` row's probe claims to take an explicit uid,
           while § 5.4 still says its sites are caller-keyed — arm14(b)'s subject.
           ⛔ Perturbs the AUTHORITY, not the cells, exactly as arm9/arm12's fixtures do: the
           keying is the matrix's claim, so the mutation has to be to the claim."""
        def _flip(pm):
            for code, row in _manifest_rows(pm):
                pr = (row.get('arm3Door') or {}).get('probe')
                if pr and pr.get('kind') == 'rls-select' and subject_keying(code, pm) == 'caller-only':
                    pr['kind'] = 'function-call'
                    pr['call'] = 'app.is_member_of_for({scope}::uuid, {uid}::uuid)'
                    return
            raise SystemExit(
                'gen-authz-differential-cells: arm14(b)\'s bad-keying fixture has no subject — '
                'no row is both `rls-select`-probed and `caller-only`. Same void-control shape '
                'as _flip_keying; see lead ruling L21.')
        return _pm_mutate(_flip)

    # ⛔ arm12's FIXTURES PERTURB THE MANIFEST AND NOTHING ELSE, exactly as arm9's do: the arm
    # exists because the value set and the door are the MATRIX's claim, not this file's, so the
    # mutation has to be to the authority.
    def _pm_mutate(fn):
        import copy
        pm = copy.deepcopy(MANIFEST_PERMISSIONS) if MANIFEST_PERMISSIONS else {}
        fn(pm)
        return pm

    def _drop_door(pm):
        for code, row in pm.items():
            if row.get('arm3Door') and (row.get('memberGateArm') or []) != [MEMBER_GATE_INERT]:
                del row['arm3Door']; return
        raise AssertionError('no carrying representative has a door — the arm12 fixture '
                             'would perturb nothing')

    def _unsweep(pm):
        for code, row in pm.items():
            if row.get('arm3Door'):
                row['memberGateArm'] = [MEMBER_GATE_INERT]; return
        raise AssertionError('no representative carries a door — the arm12 fixture would '
                             'perturb nothing')

    _pm_no_door = _pm_mutate(_drop_door)
    _pm_door_unswept = _pm_mutate(_unsweep)
    _pm_bad_keying = _pm_mutate(_flip_keying)
    _pm_nonliteral = _pm_mutate(_pm_random_id)
    _pm_flatreach = _pm_mutate(_pm_flat_reach)
    _pm_gatedp1 = _pm_mutate(_pm_gated_p1)

    checks = [
        ('arm1 empty cell set',          [],                                                      base_skipped, REPS_BY_ROLE, None, None, None),
        ('arm2 single polarity',         [c[:9] + (True,) + c[10:] for c in base_cells],          base_skipped, REPS_BY_ROLE, None, None, None),
        # ⛔ THE KEY MOVED WITH THE REP. arm3 filters by legacy-class NAME; left at
        # 'can_manage_professional' after AE4.7c it would match NOTHING, drop no class, and
        # report NOT CAUGHT — a rename orphaning a name-keyed control, which is the failure
        # this whole file exists to make loud.
        ('arm3 a class dropped',         [c for c in base_cells if c[5] != 'can_create_professional'], base_skipped, REPS_BY_ROLE, None, None, None),
        ('arm4 self-check only',         [c for c in base_cells if c[8]],                          base_skipped, REPS_BY_ROLE, None, None, None),
        ('arm5 differing-scope dropped', [c for c in base_cells if not (c[6]=='organization' and c[3]=='sibling_commission')], base_skipped, REPS_BY_ROLE, None, None, None),
        ('arm6 expectedSource blanked',  [c[:10] + ('',) + c[11:] for c in base_cells],          base_skipped, REPS_BY_ROLE, None, None, None),
        # ⛔ arm8's FOUR SHAPES, EACH ISOLATED. A fixture that trips a second arm proves nothing
        # about this one — the lesson arm1b's isolation note records, applied again.
        # ⚠ ONE CELL, NOT ALL OF THEM, and that is the stronger control twice over: a wholesale
        # wipe is a shape no real edit produces, AND it makes the column single-valued, so the
        # single-valued sub-check fires too and the fixture stops isolating what it names.
        ('arm8 divergence label blanked',  [base_cells[0][:12] + ('',) + base_cells[0][13:]] + base_cells[1:],        base_skipped, REPS_BY_ROLE, None, None, None),
        ('arm8 divergence label unknown',  [base_cells[0][:12] + ('arm3:a-label-nobody-declared',) + base_cells[0][13:]] + base_cells[1:],
                                                                                                 base_skipped, REPS_BY_ROLE, None, None, None),
        # A VALID vocabulary value applied to every cell: blank and unknown both pass, only the
        # single-valued check can fire. ⚠ It also trips arm10 since increment 3, and correctly:
        # wiping the labels strands every approved legacy GRANT with nothing to attribute it to,
        # which is exactly arm10(e). Named here rather than silenced.
        ('arm8 divergence column collapsed', [c[:12] + ('arm3:not-in-gate',) + c[13:] for c in base_cells], base_skipped, REPS_BY_ROLE, None, None, None),
        # ⛔ REPS AND CELLS RE-POINTED TOGETHER so arm3 (classes) and arm1b (codes) both stay
        # clean and arm8c fires alone. Re-pointing only one side would trip arm3 instead, and the
        # printed message would name the wrong detector.
        ('arm8 arm-3 gate lost its rep',  _repointed_cells, base_skipped, _repointed_reps, None, None, None),
        # ⛔ ISOLATED DELIBERATELY. A first draft dropped org.professionals.read from the CELLS,
        # which also drops the only member of its legacy class — so arm3 fired and arm1b was
        # never exercised. An arm caught by ANOTHER arm's message is not proof that arm works.
        # Declaring a rep that is simply never emitted isolates arm1b.
        # ⛔ THE CODE MUST BE A REAL MANIFEST KEY, AND arm9 IS WHY. A made-up code
        # (`never.emitted.code`, as this fixture read for one revision) is absent from the
        # enforcement manifest, so arm9's absent-rep branch fired FIRST and the runner printed
        # arm9's message under arm1b's name — the very "caught by another arm" contamination the
        # note above warns about, re-created by the arm added to guard the caseReach rule. Caught
        # by the WRONG ARM check in the runner below, not by reading. `org.professionals.manage` is
        # a real permission with no case arm, and its class is already declared so arm3 stays clean.
        ('arm1b rep never emitted',      base_cells, base_skipped,
         {**REPS_BY_ROLE,
          'staff_admin': REPS + [('org.professionals.manage', 'is_staff_admin_of_for', 'commission')]},
         None, None, None),
        # ⛔ arm7's THREE shapes. The first is the live defect it was resurrected for: a value the
        # axes file declares that the loop never reaches. Note the cells are the REAL ones — that
        # is the point, arm7 must fire on a cell set every other arm calls clean.
        ('arm7 axis value dropped silently', base_cells, base_skipped, REPS_BY_ROLE, None, EXCLUSIONS, ax_extra_value),
        ('arm7 axis with no disposition',    base_cells, base_skipped, REPS_BY_ROLE, None, EXCLUSIONS, ax_extra_axis),
        ('arm7 exclusion with no reason',    base_cells, base_skipped, REPS_BY_ROLE, None,
         {**EXCLUSIONS, ('principalState', 'offboarded'): ''}, None),
        # ⛔ THE SAME BAR, ON THE GATE-SCOPED DICT. Without this fixture arm7's reason check would
        # be exercised only on the value exclusions, and the conditional rules — the ones that
        # delete 2592 cells — would be held to a bar nobody had ever seen refuse anything.
        ('arm7 conditional exclusion with no reason', base_cells, base_skipped, REPS_BY_ROLE, None, None, None,
         _UNSET, {('caseReach', 'inert_outside_the_arm3_gate'): ''}),
        # ⭐ arm9's FOUR SHAPES. Cells and REPS are the REAL ones in all four — that is the point:
        # the arm must fire on a population every other arm calls clean, because the defect it
        # detects lives in the AUTHORITY for the population, not in the population.
        ('arm9 a second rep grows the case arm',   base_cells, base_skipped, REPS_BY_ROLE, None, None, None, _pm_two_armed),
        ('arm9 the arm-3 rep loses the case arm',  base_cells, base_skipped, REPS_BY_ROLE, None, None, None, _pm_disarmed),
        ('arm9 the arm-3 rep left the manifest',   base_cells, base_skipped, REPS_BY_ROLE, None, None, None, _pm_rep_absent),
        ('arm9 the manifest is unreadable',        base_cells, base_skipped, REPS_BY_ROLE, None, None, None, None),
        # ⭐ arm10's THREE SHAPES, EACH PERTURBING ONE CELL so the sub-check under test is the only
        # one that can fire. ⛔ `_one` rewrites the FIRST cell carrying the label the fixture is
        # about — never a positional index into base_cells, which would silently stop selecting a
        # labelled cell the moment the emission order changed and report NOT CAUGHT for a reason
        # that has nothing to do with the arm.
        ('arm10 approved divergence demoted', _one(ARM3_DIVERGENT_APPROVED, False), base_skipped, REPS_BY_ROLE, None, None, None),
        # ⛔ SYNTHESISED, NOT SELECTED — see _synth_defect. The defective family is EMPTY since
        # ADR 0209 fixed its one member, and a fixture that can no longer FIND its subject is the
        # shape that gets deleted, taking the arm with it.
        ('arm10 filed defect approved',       _synth_defect(),                       base_skipped, REPS_BY_ROLE, None, None, None),
        # ⛔ SYNTHESISED, NOT SELECTED — see _synth_narrower. Every real cell carrying the
        # narrower label expects a legacy DENY, so there is nothing to select.
        ('arm10 narrower label granting',     _synth_narrower(),                     base_skipped, REPS_BY_ROLE, None, None, None),
        # ⛔ SYNTHESISED, NOT SELECTED — see _synth_overreach. The derivation reads the same
        # declaration arm13 checks, so no real cell can be in this state.
        ('arm13 flip on an unreachable persona', _synth_overreach(),                  base_skipped, REPS_BY_ROLE, None, None, None),
        # A flip with no divergent label at all: the `caps-deny` cells are the honest non-vacuous
        # denials, so promoting one is exactly the unattributed exemption (e) exists to refuse.
        ('arm10 unattributed legacy flip',    _one(('arm3:silent:caps-deny',), True), base_skipped, REPS_BY_ROLE, None, None, None),
        # ⭐⭐ arm7 ON THE `role` AXIS — THE FIXTURE THAT COULD NOT EXIST BEFORE AE5 INCREMENT 1.
        # `role` had no entry in CELL_AXIS_COL, so arm7 fell back to `emitted = declared` and
        # could not fire for it at all; the comment there called that tolerable because
        # subjectRoles held one value. With two, dropping one role's cells is a whole subject
        # silently vanishing from the oracle — exactly what arm7 exists to refuse. ⛔ REPS is
        # narrowed to staff_admin IN THE SAME FIXTURE so arm1b and arm3 stay clean and arm7 is
        # the only arm that can speak: an arm caught by a neighbour's message is not proof.
        ('arm7 role value dropped', [c for c in base_cells if c[14] != 'staff'], base_skipped,
         {'staff_admin': REPS}, None, None, None),
        # ⭐⭐ arm7 ON THE memberGateArm AXIS — LEAD RULING L2's LOUD HALF. Dropping every
        # non-inert cell is the shape the rejected design produced BY CONSTRUCTION: the axis
        # declared, the coordinate PO-approved, and no cell carrying it. ⛔ Before this landing
        # arm7 COULD NOT SEE IT — memberGateArm had no CELL_AXIS_COL entry, so `emitted`
        # defaulted to `declared` and the arm was silent on the very axis L1 added.
        ('arm7 memberGateArm cells dropped',
         [c for c in base_cells if c[15] == MEMBER_GATE_INERT], base_skipped, REPS_BY_ROLE,
         None, None, None),
        # ⭐ arm12's TWO DIRECTIONS, each on the REAL cell set — the defect lives in the
        # AUTHORITY for the sweep, not in the population, so the population must be clean.
        ('arm12 a carrying rep loses its door', base_cells, base_skipped, REPS_BY_ROLE,
         None, None, None, _pm_no_door),
        ('arm12 a door with no swept values',   base_cells, base_skipped, REPS_BY_ROLE,
         None, None, None, _pm_door_unswept),
        # arm14's two halves, one per direction. (c) perturbs a CELL's binding; (b) perturbs the
        # AUTHORITY, because the keying is the matrix's claim and not this file's.
        ('arm14 a cell rebound to another fixture', _synth_badbind(), base_skipped, REPS_BY_ROLE,
         None, None, None, None),
        ('arm14 a caller-keyed door claims a principal', base_cells, base_skipped, REPS_BY_ROLE,
         None, None, None, _pm_bad_keying),
        ('arm14 a fixture id that is not a literal', base_cells, base_skipped, REPS_BY_ROLE,
         None, None, None, _pm_nonliteral),
        ('arm14 a cell bound across scopes', _synth_crossscope(), base_skipped, REPS_BY_ROLE,
         None, None, None, None),
        ('arm14 a fixture id that is a persona', _synth_personacollide(), base_skipped,
         REPS_BY_ROLE, None, None, None, None),
        ('arm14 a reach with no byScope', base_cells, base_skipped, REPS_BY_ROLE,
         None, None, None, _pm_flatreach),
        ('arm14 a P1 class on a state-gated door', base_cells, base_skipped, REPS_BY_ROLE,
         None, None, None, _pm_gatedp1),
    ]
    bad = 0
    # ⚠ THE TAIL IS PADDED, NOT TYPED OUT. Every arm added since has widened `coverage()`, and
    # widening it used to mean editing all fourteen tuples to append a `None` — a diff in which a
    # genuine fixture change is invisible. `*rest` keeps old fixtures byte-identical and makes a
    # new one additive. ⛔ `_UNSET`, not None, is the "use the real manifest" default: None is
    # itself a fixture value (the unreadable-manifest shape above).
    for name, cs, sk, rp, dp, ex, axs, *rest in checks:
        pm = rest[0] if len(rest) > 0 else _UNSET
        cond = rest[1] if len(rest) > 1 else None
        got = coverage(cs, sk, rp, dp, ex, axs, pm, cond)
        # ⭐⭐ THE FIXTURE NAMES THE ARM IT IS FOR, AND THE RUNNER NOW CHECKS THAT. Until this
        # revision the criterion was `if not got` — ANY failure counted as proof, so a fixture
        # caught by a NEIGHBOURING arm printed "caught" under this arm's name while this arm sat
        # unexercised. That is not a hypothetical: adding arm9 silently took over the arm1b
        # fixture, and only this check found it. ⛔ Do not weaken it back to a non-empty test.
        # ⚠ `want in fired`, NOT `len(got) == 1`: arm1's empty-cell-set and arm2's single-polarity
        # fixtures legitimately trip neighbours (an empty population is empty for every arm), so an
        # exactly-one rule would be false for them. ⚠ arm2's fixture also trips arm10 since
        # increment 3, and correctly so: forcing every expected_granted to true makes the blocked
        # cells disagree with their legacy expectation without a divergent label, which is exactly
        # the unattributed flip arm10 refuses. Making the fixture set BOTH columns would silence
        # arm10(e) and trip arm10(b) instead — a swap, not an isolation — so it is left alone and
        # the contamination is named here rather than averaged away. The fired list is printed so contamination on a
        # fixture documented as isolated stays visible instead of being averaged away.
        want = name.split()[0]
        fired = sorted({g.split(':', 1)[0] for g in got})
        if not got:
            print('gen-authz-differential-cells --self-test: NOT CAUGHT — %s' % name); bad += 1
        elif want not in fired:
            print('gen-authz-differential-cells --self-test: WRONG ARM — %s: expected `%s`, but '
                  'the failure(s) came from %s' % (name, want, ', '.join(fired))); bad += 1
        else:
            msg = next(g for g in got if g.startswith(want + ':'))
            print('gen-authz-differential-cells --self-test: caught — %s [fired: %s] (%s)'
                  % (name, '+'.join(fired), msg[:70]))
    # ⭐⭐ THE QUIET HALF. Every fixture above proves an arm CAN fire. arm5 was RE-PREDICATED by
    # this increment — from a constant to the role's own resolution scopes — and a re-predication
    # is only half-proven by its loud half: an arm rewritten to fire correctly for staff_admin
    # could still fire WRONGLY for a commission-only role, which is a FALSE RED, and the next
    # hand silences a false red by deleting the arm. So the silence is asserted, not assumed.
    # (Re-predicating one gate can invert another gate's failure mode — docs/learning/LESSONS.md.)
    quiet = [
        ('arm5', 'a commission-only role owes no org ascent',
         [c for c in base_cells if c[14] == 'staff'], {'staff': REPS_STAFF}),
    ]
    for want, why, cs, rp in quiet:
        got = coverage(cs, base_skipped, rp)
        fired = sorted({g.split(':', 1)[0] for g in got})
        if want in fired:
            print('gen-authz-differential-cells --self-test: FALSE RED — `%s` fired where it '
                  'must stay quiet (%s): %s' % (want, why, next(g for g in got if g.startswith(want))))
            bad += 1
        else:
            print('gen-authz-differential-cells --self-test: quiet — `%s` correctly silent (%s)'
                  % (want, why))
    # ⭐⭐ LEAD RULING L2's ABSENT HALF, AS A PROPERTY RATHER THAN AS AN ARM — and the first
    # draft got this wrong in a way worth recording. It was written as an arm7 QUIET fixture
    # ('staff_admin's cells must not make arm7 complain'), and the quiet control CAUGHT IT: arm7
    # is a GLOBAL axis-completeness arm, so asked about one role's subset it correctly reports
    # the four values that subset never emits. ⛔ The fixture was asking an arm a question the
    # arm is not designed to answer, and a green would have meant nothing. The claim L2 actually
    # makes is about the CELLS, so it is asserted on the cells.
    props = []
    _sa_gates = {c[15] for c in base_cells if c[14] == 'staff_admin'}
    if _sa_gates != {MEMBER_GATE_INERT}:
        props.append('staff_admin cells carry gate value(s) %s — it has NO matrix § 5.3 row, so '
                     'every one of its cells must sit at `%s`; a non-inert value there is a '
                     'coordinate swept for a role that cannot answer differently at it'
                     % (sorted(_sa_gates - {MEMBER_GATE_INERT}), MEMBER_GATE_INERT))
    _st_gates = {c[15] for c in base_cells if c[14] == 'staff'}
    _declared_all = set()
    for _code, _k, _r in REPS_STAFF:
        _declared_all |= set(member_gate_arms_for(_code) or [MEMBER_GATE_INERT])
    if _st_gates != _declared_all:
        props.append('staff cells carry gate values %s but its representatives declare %s — '
                     'the eleven-coordinate axis lead ruling L2 restored is not fully emitted'
                     % (sorted(_st_gates), sorted(_declared_all)))
    _n_arm3 = sum(1 for c in base_cells if c[15] != MEMBER_GATE_INERT)
    if _n_arm3 == 0:
        props.append('ZERO arm-3 axis cells were emitted — the axis is declared and measured '
                     'nowhere, which is the state L2 rejected')
    for msg in props:
        print('gen-authz-differential-cells --self-test: PROPERTY FAILED — %s' % msg); bad += 1
    if not props:
        print('gen-authz-differential-cells --self-test: property — arm-3 axis cells EMITTED '
              'for staff (%d, values %s) and ABSENT for staff_admin (inert only)'
              % (_n_arm3, sorted(_st_gates)))
    real = coverage(base_cells, base_skipped, REPS_BY_ROLE)
    if real:
        print('gen-authz-differential-cells --self-test: the REAL spec trips an arm — %s' % real[0]); bad += 1
    else:
        print('gen-authz-differential-cells --self-test: clean on the real spec (discrimination control)')
    raise SystemExit(0 if bad == 0 else 1)

_fail = coverage(cells, skipped, REPS_BY_ROLE)
if _fail:
    print('gen-authz-differential-cells: COVERAGE FAILURE — refusing to emit.')
    for x in _fail: print('  - ' + x)
    raise SystemExit(1)

assert cells, 'refusing to emit an empty differential'
srcs = sorted({c[10] for c in cells})
q = lambda x: "'" + str(x).replace("'", "''") + "'"
b = lambda x: 'true' if x else 'false'
def _render(cs, wide):
    """14 columns for staff_admin, 16 for staff. ⛔ NOT an oversight and NOT the "identical column
       lists" an earlier revision promised: the two extra columns ARE the axis lead ruling L2
       restored, and putting them on the shared shape would change `authz_differential_cells` —
       the table `403` reads and whose 1728 rows this landing keeps byte-identical. A suite that
       does not sweep the axis has nothing to do with the column."""
    if wide:
        return ',\n'.join(
            '    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
                q(c[0]), q(c[1]), q(c[2]), q(c[3]), q(c[4]), q(c[5]), q(c[6]), q(c[7]),
                b(c[8]), b(c[9]), q(c[10]), q(c[11]), q(c[12]), b(c[13]), q(c[15]), q(c[16]),
                q(c[17]), q(c[18]), q(c[19]), q(c[20]), q(c[21]), q(c[22]))
            for c in cs)
    return ',\n'.join(
        '    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
            q(c[0]), q(c[1]), q(c[2]), q(c[3]), q(c[4]), q(c[5]), q(c[6]), q(c[7]),
            b(c[8]), b(c[9]), q(c[10]), q(c[11]), q(c[12]), b(c[13]))
        for c in cs)


# ⭐⭐ ONE TABLE PER SUBJECT ROLE, AND THE SPLIT IS WHAT KEEPS AE4 NON-REGRESSIVE. A single shared
# table with a `role` column would have forced `403` — the staff_admin oracle, with ~20
# count-pinned sections — to gain a `where role = 'staff_admin'` filter and to re-derive every one
# of those counts. That is a large, high-risk edit to a suite this increment has no finding
# against. Split per role, `authz_differential_cells` keeps EXACTLY the columns and EXACTLY the
# rows it had, so 403 is untouched and its greenness after this landing is evidence rather than
# hope; `424` reads its own table with the identical column list.
# ⛔ THE COLUMN LISTS ARE NOT IDENTICAL, AND THE DIFFERENCE IS THE POINT (lead ruling L2). The
# staff table carries TWO MORE: `member_gate_arm`, the swept coordinate for the eleven rows matrix
# § 5.3 found, and `legacy_door`, the callable `424`'s legacy column must evaluate for that row —
# read from the manifest's `arm3Door` rather than re-derived, so the suite cannot drift from the
# declaration the axis was swept against. Putting them on the shared shape would change the table
# `403` reads, whose 1728 rows this landing keeps byte-identical.
_by_role = {}
for _c in cells:
    _by_role.setdefault(_c[14], []).append(_c)
_ROLE_TABLE = {'staff_admin': 'authz_differential_cells',
               'staff': 'authz_differential_cells_staff'}
_missing_table = sorted(set(_by_role) - set(_ROLE_TABLE))
assert not _missing_table, (
    'subject role(s) with cells but no output table name: %s — a role whose cells are generated '
    'and never emitted is a silent coverage loss of exactly the shape this file gates against'
    % _missing_table)

_COLS = ('cell_id, persona, active_context, scope, permission_code, legacy_class,\n'
         '         resolution_scope_kind, principal_state, self_check, expected_granted, '
         'expected_source,\n         case_reach, arm3_divergence, expected_legacy_granted')
_COLS_WIDE = _COLS + (',\n         member_gate_arm, legacy_door,\n'
                      '         legacy_sql, catalog_sql, legacy_fixture_id, keying,\n'
                      '         probe_table, probe_column')
_WIDE = {'staff'}

tables = '\n\n'.join(
    'create temp table %s on commit drop as\n  select * from (values\n%s\n  ) as t(%s);'
    % (_ROLE_TABLE[r], _render(_by_role[r], r in _WIDE), _COLS_WIDE if r in _WIDE else _COLS)
    for r in sorted(_by_role))

_role_census = '\n'.join(
    '--   %-14s %-38s %6d cells  (%d columns)'
    % (r, _ROLE_TABLE[r], len(_by_role[r]), 16 if r in _WIDE else 14)
    for r in sorted(_by_role))
# ⭐ THE ARM-3 CELL COUNT, PRINTED AS AN OUTPUT. The eleven carrying rows' non-inert cells are what
# lead ruling L2 restored; stating the figure in the artifact means the next reader checks it
# against the eleven rather than trusting a sentence.
_arm3_cells = sum(1 for c in cells if c[15] != MEMBER_GATE_INERT)
_arm3_rows = sorted({c[4] for c in cells if c[15] != MEMBER_GATE_INERT})
_role_census += ('\n--   arm-3 axis cells (memberGateArm <> %s): %d over %d representative(s)'
                 % (MEMBER_GATE_INERT, _arm3_cells, len(_arm3_rows)))

# The per-label census, printed in the header so the NOT-COVERAGE count cannot be quoted as
# coverage by anyone reading the total.
_div_census = {}
for c in cells:
    _div_census[c[12]] = _div_census.get(c[12], 0) + 1
divcensus = '\n'.join('--   %-44s %6d   %s' % (k, _div_census[k], ARM3_DIVERGENCE_VALUES[k])
                       for k in sorted(_div_census))
notcov = sum(_div_census.get(k, 0) for k in NOT_ARM3_COVERAGE)
# ⭐ THE FLIP CENSUS. `expected_legacy_granted` differs from `expected_granted` on exactly the
# cells PO ruling R2 declared approved divergent reach, and printing the breakdown here is what
# stops the second column from being read as a second copy of the first.
_flip_census = {}
for c in cells:
    if c[13] != c[9]:
        _flip_census[(c[12], c[11])] = _flip_census.get((c[12], c[11]), 0) + 1
flips = '\n'.join('--   %-44s at case_reach=%-12s %4d' % (k[0], k[1], v)
                  for k, v in sorted(_flip_census.items()))
nflip = sum(_flip_census.values())
npre = _div_census.get(ARM3_PREEMPTED, 0)
excl = '; '.join('%s.%s' % (a, v) for (a, v) in sorted(EXCLUSIONS))
# ⛔ THE CONDITIONAL RULES' REASONS ARE PRINTED IN FULL, not summarised to a name. A rule that
# deletes 2592 cells is read by whoever opens THIS file when a count looks wrong; a name alone
# would send them to the generator to find out why, and the standing condition — the sentence that
# says when the rule stops being true — is exactly the part a summary drops.
condexcl = '\n--\n'.join(
    '--   %s.%s — skip counter `%s_%s`\n%s' % (a, n, a, n,
        textwrap.fill(CONDITIONAL_EXCLUSIONS[(a, n)], width=94,
                      initial_indent='--     ', subsequent_indent='--     '))
    for (a, n) in sorted(CONDITIONAL_EXCLUSIONS))

body = """-- GENERATED FILE — DO NOT EDIT BY HAND.
-- Source:    supabase/tests/vectors/authz-matrix-axes.json
-- Generator: scripts/gen-authz-differential-cells.py   (--check is chained into lint gate 12)
-- sourceSha256: %s
--
-- AE4.5 differential cells. %d cells over %d legacy-equivalence classes, %d representative(s)
-- (pgTAP 401 §19.2 asserts the partition; 403 §2.3 asserts this class count), %d skipped by
-- named rule. ⚠ THE TWO COUNTS ARE DERIVED FROM `REPS`, NOT TYPED: they read "THREE" for as
-- long as there were three reps and stayed at THREE through AE4.9's fourth, so this header
-- asserted a stale partition in the very file that carries the oracle's expected values.
--
-- ⛔ EXPECTED VALUES COME FROM EXACTLY TWO HAND-ENCODED SOURCES, never from resolver logic:
--   (1) the approved matrix row  — staff_admin holds every representative;
--   (2) the approved deny-class effect table (docs/design/authz-ae45-deny-class-effects.md).
-- The generator TRANSCRIBES that 9-row table in its stated precedence. It performs no
-- scope-reaching join, no closure lookup and no role_permissions read — it is deliberately
-- NOT a second implementation of candidate_has_permission, because a suite whose expected
-- values are computed the way the resolver computes them proves only that the resolver
-- equals itself.
--
-- ⚠ AXIS VALUES EXCLUDED BY NAME (arm7 refuses any that are not): %s
--   `principalState.offboarded` is FILLABLE and awaiting a PO expected value — not unfillable.
--
-- expectedSource values present: %s
--
-- ══ `case_reach` AND `arm3_divergence` — AE5-MATRIX-ARM3-CELLS, PO ruling R1 ════════════════
-- ⭐ ARM 3 OF app.can_read_professional_profile IS NOW A SWEPT COORDINATE, not a prose caveat.
-- `case_reach` is the axis (see axes.caseReach._source for the predicate and for why
-- `unreachable` is mandatory); `arm3_divergence` is the DISPOSITION the generator transcribes
-- from the arm-3 derivation, exactly as the expected values transcribe the deny-class table.
--
-- ⛔⛔ `arm3_divergence` IS STILL NOT AN EXPECTED VALUE — IT IS THE ATTRIBUTION FOR ONE, AND
-- INCREMENT 3 CORRECTED WHERE THAT ONE LIVES. Increment 1 wrote that R2's GRANT would land in
-- `expected_granted` once `expected()` gained a `reach` parameter. The participation fixture
-- MEASURED that it cannot, and the reason is a fact about the two subjects 403 compares:
--   `expected_granted` is what §5.1 compares against `authz.candidate_has_permission`, a pure
--   role/permission resolver with NO case arm. Live at head (20261003007390, 528), at the
--   class-4 grant_keyed coordinate (an org-B staff_admin, an org-A professional profile, one
--   case_access_grants row on an org-A case):
--       app.can_read_professional_profile = TRUE   (arm1 f | arm2a f | arm2b f | caps 6)
--       authz.candidate_has_permission    = FALSE
--   Flipping `expected_granted` would have RED §5.1 on every divergent cell, and it would have
--   been wrong: the resolver correctly denies an org permission the caller does not hold. What
--   arm 3 reaches is NOT the permission — it is a case-grant reach the permission model
--   deliberately does not express. That makes this a legacy-vs-catalog DIVERGENCE (§4), not a
--   matrix disagreement (§5).
-- ⇒ R2's approved GRANT lands in `expected_legacy_granted`, the LAST column, carrying the legacy
--   DOOR's approved answer. `expected_granted` moved by EXACTLY ZERO cells. 403 §4.1 compares
--   legacy against catalog only where the two expectations agree, and §4.1b asserts
--   `legacy == expected_legacy_granted` on every cell — so the carve-out from §4.1 is paid for
--   by a VALUE, never by an exemption.
--
-- ⭐⭐ THE FILED DEFECT IS FIXED, AND THE CARVE-OUT IT PAID FOR IS GONE (ADR 0209, migration
-- 20261003007400). `%s` labels the %d cells the door now denies
-- BEFORE any arm is evaluated: a SELF-check by a principal who HOLDS a live role, under a hat
-- that is none of the roles they hold. They are 10 + 8 — the ten cells of the filed bug
-- (`arm3:divergent-defective:hat-unenforceable`, which labels nothing now), PLUS EIGHT that this
-- generator's own precedence had labelled `arm3:divergent-approved:cross-org` because
-- `expected()` resolves scope (`deny-class:cross_org`) BEFORE the hat.
-- ⭐ THOSE EIGHT ARE A RE-RULING (ADR 0209 D5, **PO to ratify**): PO ruling R2 approved CROSS-ORG
-- reach and never spoke to the WRONG HAT, and a hat term conditioned on org would BE the org
-- check R2 forbids. ⛔ NO CELL IS EXCUSED FROM §4.1/§4.1b ANY MORE — the carve-out by label is
-- deleted and every cell is compared BY VALUE. arm10 still refuses a defect laundered into an
-- expected value: it keys on the `arm3:divergent-defective:` FAMILY, which is empty today, and
-- --self-test SYNTHESISES a member so the detector stays exercised rather than quietly retired.
--
-- ══ WHERE THE TWO EXPECTED VALUES DIVERGE (%d cell(s)) ═══════════════════════════════════════
%s
--
-- ⛔ `divergent-approved` (R2: an explicit case grant needs no role and anchors on the CASE, not
-- the caller's org), `divergent-defective` (a filed bug — the family is EMPTY since ADR 0209) and
-- `pre-empted` (the door's own hat term, DENY by ruling) ARE DIFFERENT VALUES ON PURPOSE. Merging
-- any two of them encodes one class's behaviour as another's approved answer, which is the one
-- thing R2 forbids — and it stays forbidden now that the first defect is fixed, because the next
-- one will arrive wearing the same shape.
--
--   arm-3 coverage: %d      ⛔ NOT arm-3 coverage: %d
-- ⚠ THE SECOND NUMBER IS NOT A FOOTNOTE. `blocked:principal-state` cells cannot be made to fire
-- arm 3 by ANY fixture (_case_caps STEP 2), and `not-in-gate` cells belong to a different door;
-- counting either as arm-3 coverage inflates the report with cells that cannot fail for an
-- arm-3 reason. They remain perfectly good cells for the deny-class table they do measure.
--
-- ⚠⚠ caseReach IS GATE-SCOPED, BY A NAMED RULE — the population is 1728, not 4320, and the
-- 2592-cell difference is the point rather than a saving. Only ONE of the five representatives has
-- a gate with a case arm, so on the other four the reach cannot change the answer: measured at the
-- unconditional sweep, their 3456 cells carried 864 DISTINCT PAYLOADS and 2592 exact copies
-- differing only in a `case_reach` value no door reads. ⛔ Those copies inflate apparent coverage
-- — the vacuous-assertion family this tree gates against — and they pre-pay NOTHING, because the
-- `arm3:not-in-gate` label they carried was itself computed from a static name in the generator
-- and would no more auto-notice a new case arm than the skip rule would. The full reason, and the
-- STANDING CONDITION under which it must be revisited, is the CONDITIONAL_EXCLUSIONS entry printed
-- below. ⭐ IT IS NOT AN UNREASONED SAVING AND CANNOT BECOME ONE: arm7 refuses the rule if its
-- reason is ever blanked, arm7 ALSO refuses the moment the rule widens far enough to drop a reach
-- value from the whole population, and arm9 re-reads the enforcement manifest on every run and
-- refuses to emit if the case-armed representative set stops being exactly {%s}.
--
-- ══ CONDITIONAL (GATE-SCOPED) EXCLUSIONS — the rule, in full, so it cannot be lost ═══════════
%s
--
%s
-- ══ ONE TABLE PER SUBJECT ROLE (AE5 increment 1) ═════════════════════════════════════════════
-- ⛔ `authz_differential_cells` is staff_admin's and is unchanged in shape and content by the
-- multi-role landing; `403` reads it and needed no edit. Each role's table carries the IDENTICAL
-- column list.
%s
--
%s
""" % (sha, len(cells), len({r[1] for r in reps_flat_top}), len(reps_flat_top),
       sum(skipped.values()),
       excl, ', '.join(srcs), ARM3_PREEMPTED, npre, nflip, flips,
       len(cells) - notcov, notcov, ARM3_GATE, condexcl, divcensus, _role_census, tables)

if '--check' in sys.argv:
    try:
        current = io.open(OUT, 'r', encoding='utf-8').read()
    except IOError:
        print('gen-authz-differential-cells: %s is missing — run the generator.' % OUT)
        raise SystemExit(1)
    # ⚠ Normalise line endings before comparing, the way the .mjs sibling does — a raw compare
    # is CRLF-brittle on Windows with core.autocrlf.
    if current.replace('\r\n', '\n') != body:
        print('gen-authz-differential-cells: DRIFT — the generated .psql does not match the axes '
              'JSON or this generator.\n'
              '  ⛔ This file carries the ORACLE\'S EXPECTED VALUES. Drift here means either the '
              'axes moved without regeneration, or someone hand-edited an expected_granted.\n'
              '  Run `python scripts/gen-authz-differential-cells.py` and review the diff before '
              'committing it.')
        raise SystemExit(1)
    print('gen-authz-differential-cells: in sync (%d cells, %d skipped, sha %s)'
          % (len(cells), sum(skipped.values()), sha[:12]))
    raise SystemExit(0)

io.open(OUT, 'w', encoding='utf-8', newline='\n').write(body)
print('cells=%d skipped=%d (%s)' % (len(cells), sum(skipped.values()), skipped))
print('expectedSource:', srcs)
print('granted=%d denied=%d' % (sum(1 for c in cells if c[9]), sum(1 for c in cells if not c[9])))
print('legacy_granted=%d denied=%d  (flips vs expected_granted: %d, pre-empted by the door hat '
      'term: %d, defective-family: %d)'
      % (sum(1 for c in cells if c[13]), sum(1 for c in cells if not c[13]), nflip, npre,
         sum(1 for c in cells if c[12].startswith(ARM3_DEFECT_PREFIX))))
