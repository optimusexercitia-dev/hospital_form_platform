#!/usr/bin/env python
# AE4.5 differential-oracle cell generator.
#
#   python scripts/gen-authz-differential-cells.py            # regenerate the .psql
#   python scripts/gen-authz-differential-cells.py --check    # verify, exit 1 on drift (gate 12)
#   python scripts/gen-authz-differential-cells.py --self-test # prove every coverage arm fires
#
# ⛔ THE AXES COME FROM THE JSON, NOT FROM THIS FILE. An earlier revision hard-coded every axis
# list here while sha-stamping a JSON it never read, so `principalState: offboarded` — a value the
# axes file explicitly RULES an "ORDINARY FILLABLE COORDINATE" — and `scope: zero_scope` were both
# dropped with no rule, no counter and no arm able to notice (QA 2026-09-01, F4). Values are now
# read from the file, and any value this generator does not emit must be named in EXCLUSIONS with
# a reason. arm7 is what enforces that, and arm7 itself is exercised by --self-test.

import io, os, json, sys, hashlib

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
    # ⚠ 403 § 2.3b asserts rows 31 and 32 STILL share one body — that co-sharing is the entire
    # basis for one rep covering both, and if a later change splits THEM it is what catches it.
    ('org.case_vocabulary.manage',  'can_manage_case_vocabulary',   'organization'),
]

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
    'operation':      'not-swept: stood in for by the legacy-class REPS above. Per-permission '
                      'AXES are not observable until AE5 gives a role a partial map; per-permission '
                      'GRANT is covered by 401 §19.4 (403 header, PER-PERMISSION GRAIN).',
    'resourceLifecycle': 'not-swept: none of the representatives acts on a lifecycled '
                      'resource — every cell is `not_applicable`. A rep that did would make this '
                      'a loop coordinate.',
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

# ── Axis values, READ FROM THE JSON. ⛔ Never re-list them here. ────────────────────────
def axis_values(name):
    return list(spec['axes'][name]['values'].keys())

personas    = axis_values('persona')
contexts    = axis_values('activeContext')
scopes      = axis_values('scope')
states      = axis_values('principalState')
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
assert len(subject_roles) == 1, 'AE4 substitutes exactly ONE role (ADR 0155 D7); got %s' % subject_roles
SUBJECT_ROLE = subject_roles[0]


def expected(persona, ctx, scope, state, selfcheck, res_scope):
    """EXPECTED VALUES COME FROM EXACTLY TWO HAND-ENCODED SOURCES — never resolver logic.
       (1) the approved matrix row: staff_admin holds all three representatives — after AE4.7c
           that is org.professionals.create, NOT .manage, which staff_admin lost;
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


def build(personas, contexts, scopes, states, reps, exclusions):
    """Returns (cells, skipped). EVERY skip counter counts CELLS, at one grain, so that
       `len(cells) + sum(skipped.values())` equals the full grid exactly — asserted below.
       ⛔ An earlier shape short-circuited excluded AXIS VALUES at their own loop level, so those
       counters counted loop PREFIXES while the inner rules counted cells: a census whose parts
       cannot sum, and the header total was then a number of nothing."""
    cells, skipped = [], {}

    def skip(rule):
        skipped[rule] = skipped.get(rule, 0) + 1

    for code, klass, res in reps:
        for persona in personas:
            for ctx in contexts:
                for scope in scopes:
                    for state in states:
                        for selfcheck in (True, False):
                            # ⭐ THE NAMED AXIS EXCLUSIONS (arm7's subject). Checked here, at cell
                            # grain, and attributed to the axis value that elided the cell.
                            axis_hit = next((('%s:%s' % (a, v))
                                             for a, v in (('persona', persona), ('activeContext', ctx),
                                                          ('scope', scope), ('principalState', state))
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
                            exp, src = expected(persona, ctx, scope, state, selfcheck, res)
                            cid = '|'.join([persona, SUBJECT_ROLE, ctx, scope, code, state,
                                            'self' if selfcheck else 'third_party'])
                            cells.append((cid, persona, ctx, scope, code, klass, res, state, selfcheck, exp, src))
    return cells, skipped


cells, skipped = build(personas, contexts, scopes, states, REPS, EXCLUSIONS)

# ⭐ THE CENSUS SUMS. Every cell of the declared grid is either emitted or attributed to exactly
# one named rule. ⛔ Without this the header's "N skipped" is a number of nothing, and a rule that
# quietly elides a coordinate twice (or not at all) is invisible.
_GRID = len(REPS) * len(personas) * len(contexts) * len(scopes) * len(states) * 2
assert len(cells) + sum(skipped.values()) == _GRID, (
    'the census does not sum: %d emitted + %d skipped != %d declared grid cells'
    % (len(cells), sum(skipped.values()), _GRID))


def coverage(cells, skipped, reps, disposition=None, exclusions=None, axes=None):
    """EIGHT ARMS. ⛔ An arm that has never refused anything is a detector nobody has shown finds
       something — every one is exercised by --self-test below."""
    disposition = AXIS_DISPOSITION if disposition is None else disposition
    exclusions = EXCLUSIONS if exclusions is None else exclusions
    axes = spec['axes'] if axes is None else axes
    f = []
    if not cells:
        f.append('arm1: the cell set is EMPTY — pgTAP would iterate nothing and pass')
    if not (any(c[9] for c in cells) and any(not c[9] for c in cells)):
        f.append('arm2: expected values are single-polarity — a resolver stuck on one answer would pass')
    # ⭐ arm3 COMPARES SETS, DERIVED FROM `reps`, NOT A HARD-CODED 3. The literal was correct
    # for as long as there were three reps and became a false gate the moment AE4.9 added a
    # fourth — it refused a CORRECT cell set. ⛔ It is not a tautology against arm1b: arm1b
    # keys on the permission CODE (c[4]) and this keys on the legacy CLASS (c[5]), and two reps
    # may legitimately share a class, so neither implies the other.
    # ⚠ THE SWEEP COVERS 4 OF THE 6 CLASSES 401 §19.2 counts. can_manage_professional (row 30)
    # has no rep because staff_admin does not hold that code, and can_manage_external_participant
    # (row 31) is covered BY BODY IDENTITY with org.case_vocabulary.manage — 403 §2.3b asserts
    # that identity rather than assuming it.
    _declared_classes = {r[1] for r in reps}
    _emitted_classes = {c[5] for c in cells}
    if _declared_classes != _emitted_classes:
        f.append('arm3: swept legacy-equivalence classes do not match the declared REPS — '
                 'declared-not-emitted %s, emitted-not-declared %s'
                 % (sorted(_declared_classes - _emitted_classes) or '(none)',
                    sorted(_emitted_classes - _declared_classes) or '(none)'))
    if not (any(c[8] for c in cells) and any(not c[8] for c in cells)):
        f.append('arm4: §6A both-polarity missing — self-check AND third-party are both required, or '
                 'the suite passes while pinning the uniform-apply bug')
    if not any(c[6] == 'organization' and c[3] == 'sibling_commission' and c[9] for c in cells):
        f.append('arm5: §11.3 differing-scope cell missing — the whole org-scoped class would go untested')
    if any(not c[10] for c in cells):
        f.append('arm6: a cell carries no expectedSource — an unattributed expected value is not an oracle input')

    # ⭐ arm7 — THE AXIS-COMPLETENESS ARM, and the one this generator most needed.
    # Its predecessor read `sum(skipped.values()) > 0 and not skipped`, which is tautologically
    # FALSE (a non-zero sum implies a non-empty dict), so it had never refused anything and could
    # not: it was keyed on the skip DICT, and a value that never enters the loop is not in it.
    # Keyed on the DECLARED AXES instead, it sees exactly what its predecessor could not.
    CELL_AXIS_COL = {'persona': 1, 'activeContext': 2, 'scope': 3, 'principalState': 7}
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
    for (axis, value), reason in sorted(exclusions.items()):
        if not reason:
            f.append('arm7: exclusion %s.%s carries no reason — an unattributed exclusion is a '
                     'silent population shrink wearing a rule\'s clothes' % (axis, value))

    declared = {r[0] for r in reps}
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
    checks = [
        ('arm1 empty cell set',          [],                                                      base_skipped, REPS, None, None, None),
        ('arm2 single polarity',         [c[:9] + (True,) + c[10:] for c in base_cells],          base_skipped, REPS, None, None, None),
        # ⛔ THE KEY MOVED WITH THE REP. arm3 filters by legacy-class NAME; left at
        # 'can_manage_professional' after AE4.7c it would match NOTHING, drop no class, and
        # report NOT CAUGHT — a rename orphaning a name-keyed control, which is the failure
        # this whole file exists to make loud.
        ('arm3 a class dropped',         [c for c in base_cells if c[5] != 'can_create_professional'], base_skipped, REPS, None, None, None),
        ('arm4 self-check only',         [c for c in base_cells if c[8]],                          base_skipped, REPS, None, None, None),
        ('arm5 differing-scope dropped', [c for c in base_cells if not (c[6]=='organization' and c[3]=='sibling_commission')], base_skipped, REPS, None, None, None),
        ('arm6 expectedSource blanked',  [c[:10] + ('',) for c in base_cells],                     base_skipped, REPS, None, None, None),
        # ⛔ ISOLATED DELIBERATELY. A first draft dropped org.professionals.read from the CELLS,
        # which also drops the only member of its legacy class — so arm3 fired and arm1b was
        # never exercised. An arm caught by ANOTHER arm's message is not proof that arm works.
        # Declaring a rep that is simply never emitted isolates arm1b.
        ('arm1b rep never emitted',      base_cells, base_skipped,
         REPS + [('never.emitted.code', 'is_staff_admin_of_for', 'commission')], None, None, None),
        # ⛔ arm7's THREE shapes. The first is the live defect it was resurrected for: a value the
        # axes file declares that the loop never reaches. Note the cells are the REAL ones — that
        # is the point, arm7 must fire on a cell set every other arm calls clean.
        ('arm7 axis value dropped silently', base_cells, base_skipped, REPS, None, EXCLUSIONS, ax_extra_value),
        ('arm7 axis with no disposition',    base_cells, base_skipped, REPS, None, EXCLUSIONS, ax_extra_axis),
        ('arm7 exclusion with no reason',    base_cells, base_skipped, REPS, None,
         {**EXCLUSIONS, ('principalState', 'offboarded'): ''}, None),
    ]
    bad = 0
    for name, cs, sk, rp, dp, ex, axs in checks:
        got = coverage(cs, sk, rp, dp, ex, axs)
        if not got:
            print('gen-authz-differential-cells --self-test: NOT CAUGHT — %s' % name); bad += 1
        else:
            print('gen-authz-differential-cells --self-test: caught — %s (%s)' % (name, got[0][:70]))
    real = coverage(base_cells, base_skipped, REPS)
    if real:
        print('gen-authz-differential-cells --self-test: the REAL spec trips an arm — %s' % real[0]); bad += 1
    else:
        print('gen-authz-differential-cells --self-test: clean on the real spec (discrimination control)')
    raise SystemExit(0 if bad == 0 else 1)

_fail = coverage(cells, skipped, REPS)
if _fail:
    print('gen-authz-differential-cells: COVERAGE FAILURE — refusing to emit.')
    for x in _fail: print('  - ' + x)
    raise SystemExit(1)

assert cells, 'refusing to emit an empty differential'
srcs = sorted({c[10] for c in cells})
q = lambda x: "'" + str(x).replace("'", "''") + "'"
rows = ',\n'.join(
    '    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
        q(c[0]), q(c[1]), q(c[2]), q(c[3]), q(c[4]), q(c[5]), q(c[6]), q(c[7]),
        'true' if c[8] else 'false', 'true' if c[9] else 'false', q(c[10]))
    for c in cells)
excl = '; '.join('%s.%s' % (a, v) for (a, v) in sorted(EXCLUSIONS))

body = """-- GENERATED FILE — DO NOT EDIT BY HAND.
-- Source:    supabase/tests/vectors/authz-matrix-axes.json
-- Generator: scripts/gen-authz-differential-cells.py   (--check is chained into lint gate 12)
-- sourceSha256: %s
--
-- AE4.5 differential cells. %d cells over the THREE legacy-equivalence classes
-- (pgTAP 401 §19.2 asserts the partition), %d skipped by named rule.
--
-- ⛔ EXPECTED VALUES COME FROM EXACTLY TWO HAND-ENCODED SOURCES, never from resolver logic:
--   (1) the approved matrix row  — staff_admin holds all three representatives;
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
create temp table authz_differential_cells on commit drop as
  select * from (values
%s
  ) as t(cell_id, persona, active_context, scope, permission_code, legacy_class,
         resolution_scope_kind, principal_state, self_check, expected_granted, expected_source);
""" % (sha, len(cells), sum(skipped.values()), excl, ', '.join(srcs), rows)

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
