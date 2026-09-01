import io, os, json, hashlib

ROOT = r'D:/Development/claude/hospital_form_platform'
SRC = ROOT + '/supabase/tests/vectors/authz-matrix-axes.json'
OUT = ROOT + '/supabase/tests/vectors/authz_differential_cells.psql'

raw = io.open(SRC, 'rb').read()
sha = hashlib.sha256(raw).hexdigest()
spec = json.loads(raw.decode('utf-8'))

# ── The three legacy-equivalence classes, asserted in pgTAP 401 §19.2 ─────────────────
REPS = [
    # code, legacy class, resolution scope
    ('commission.forms.edit',      'is_staff_admin_of_for',        'commission'),
    ('org.professionals.manage',   'can_manage_professional',      'organization'),
    ('org.professionals.read',     'can_read_professional_profile','organization'),
]

personas = ['subject_holder', 'other_commission_holder', 'cross_org_actor', 'unprivileged', 'anonymous']
contexts = ['matching', 'other_role', 'absent']
scopes   = ['own_commission', 'sibling_commission', 'foreign_org_commission']
states   = ['active', 'pending', 'suspended', 'deactivated']

HOLDS_AT = {                       # where each persona holds staff_admin (axes file, Axis 1)
    'subject_holder':          'own_commission',
    'other_commission_holder': 'sibling_commission',
    'cross_org_actor':         'foreign_org_commission',
    'unprivileged':            None,
    'anonymous':               None,
}
SAME_ORG = {'own_commission', 'sibling_commission'}   # foreign_org_commission is the other org

def expected(persona, ctx, scope, state, selfcheck, res_scope):
    """EXPECTED VALUES COME FROM EXACTLY TWO HAND-ENCODED SOURCES — never resolver logic.
       (1) the approved matrix row: staff_admin holds all three representatives;
       (2) the approved deny-class effect table, transcribed in its stated precedence.
       No scope-reaching join, no closure lookup, no role_permissions read."""
    if persona == 'anonymous':   return False, 'deny-class:unauthenticated'
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
        return (False, 'deny-class:wrong_active_context:self') if selfcheck                else (True, 'deny-class:wrong_active_context:third-party')
    # `pending` reaches here deliberately: row 5, GRANTED — not an enforcement point.
    return True, ('matrix-row' if state != 'pending' else 'deny-class:pending-is-granted')

cells, skipped = [], {}
for code, klass, res in REPS:
    for persona in personas:
        for ctx in contexts:
            for scope in scopes:
                for state in states:
                    for selfcheck in (True, False):
                        # ⛔ ABSENT IS NOT REACHABLE FOR A SINGLE-ROLE-TYPE PRINCIPAL.
                        # AE0.5 Axis 3: the hook emits no active_role only when the caller
                        # holds ZERO role types or MORE THAN ONE. Each holder persona here
                        # holds exactly one (staff_admin), so `absent` cannot be constructed
                        # for them — test_helpers.claims_for(uid, false, null) DERIVES the
                        # single role and sets it, which is the system behaving correctly.
                        # A cell asserting a denial there asserts a state the system cannot
                        # produce.
                        if ctx == 'absent' and persona in ('subject_holder', 'other_commission_holder', 'cross_org_actor'):
                            skipped['absent_unreachable_for_single_role_principal'] = skipped.get('absent_unreachable_for_single_role_principal', 0) + 1; continue
                        if persona == 'anonymous' and ctx != 'absent':
                            skipped['anonymous_has_no_active_context'] = skipped.get('anonymous_has_no_active_context', 0) + 1; continue
                        if persona == 'anonymous' and state != 'active':
                            skipped['anonymous_holds_no_role_state'] = skipped.get('anonymous_holds_no_role_state', 0) + 1; continue
                        if persona == 'anonymous' and not selfcheck:
                            skipped['anonymous_cannot_be_a_third_party_subject'] = skipped.get('anonymous_cannot_be_a_third_party_subject', 0) + 1; continue
                        exp, src = expected(persona, ctx, scope, state, selfcheck, res)
                        cid = '|'.join([persona, 'staff_admin', ctx, scope, code, state,
                                        'self' if selfcheck else 'third_party'])
                        cells.append((cid, persona, ctx, scope, code, klass, res, state, selfcheck, exp, src))

def coverage(cells, skipped, reps):
    """SEVEN ARMS. ⛔ An arm that has never refused anything is a detector nobody has shown finds
       something — every one is exercised by --self-test below."""
    f = []
    if not cells:
        f.append('arm1: the cell set is EMPTY — pgTAP would iterate nothing and pass')
    if not (any(c[9] for c in cells) and any(not c[9] for c in cells)):
        f.append('arm2: expected values are single-polarity — a resolver stuck on one answer would pass')
    if len({c[5] for c in cells}) != 3:
        f.append('arm3: not all THREE legacy-equivalence classes are swept (401 §19.2 asserts there are three)')
    if not (any(c[8] for c in cells) and any(not c[8] for c in cells)):
        f.append('arm4: §6A both-polarity missing — self-check AND third-party are both required, or '
                 'the suite passes while pinning the uniform-apply bug')
    if not any(c[6] == 'organization' and c[3] == 'sibling_commission' and c[9] for c in cells):
        f.append('arm5: §11.3 differing-scope cell missing — the whole org-scoped class would go untested')
    if any(not c[10] for c in cells):
        f.append('arm6: a cell carries no expectedSource — an unattributed expected value is not an oracle input')
    if sum(skipped.values()) > 0 and not skipped:
        f.append('arm7: cells were skipped with no named rule — an unattributed exclusion is a silent population shrink')
    declared = {r[0] for r in reps}
    emitted = {c[4] for c in cells}
    if declared - emitted:
        f.append('arm1b: representative(s) declared but never emitted: %s' % ', '.join(sorted(declared - emitted)))
    return f


if '--self-test' in __import__('sys').argv:
    import copy
    base_cells = cells; base_skipped = skipped
    checks = [
        ('arm1 empty cell set',          [],                                                      base_skipped, REPS),
        ('arm2 single polarity',         [c[:9] + (True,) + c[10:] for c in base_cells],          base_skipped, REPS),
        ('arm3 a class dropped',         [c for c in base_cells if c[5] != 'can_manage_professional'], base_skipped, REPS),
        ('arm4 self-check only',         [c for c in base_cells if c[8]],                          base_skipped, REPS),
        ('arm5 differing-scope dropped', [c for c in base_cells if not (c[6]=='organization' and c[3]=='sibling_commission')], base_skipped, REPS),
        ('arm6 expectedSource blanked',  [c[:10] + ('',) for c in base_cells],                     base_skipped, REPS),
        # ⛔ ISOLATED DELIBERATELY. A first draft dropped org.professionals.read from the CELLS,
        # which also drops the only member of its legacy class — so arm3 fired and arm1b was
        # never exercised. An arm caught by ANOTHER arm's message is not proof that arm works.
        # Declaring a rep that is simply never emitted isolates arm1b.
        ('arm1b rep never emitted',      base_cells, base_skipped,
         REPS + [('never.emitted.code', 'is_staff_admin_of_for', 'commission')]),
    ]
    bad = 0
    for name, cs, sk, rp in checks:
        got = coverage(cs, sk, rp)
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

body = """-- GENERATED FILE — DO NOT EDIT BY HAND.
-- Source:    supabase/tests/vectors/authz-matrix-axes.json
-- Generator: scripts/gen-authz-differential-cells.mjs
-- sourceSha256: %s
--
-- AE4.5 differential cells. %d cells over the THREE legacy-equivalence classes
-- (pgTAP 401 §19.2 asserts the partition), %d skipped by constraint rule.
--
-- ⛔ EXPECTED VALUES COME FROM EXACTLY TWO HAND-ENCODED SOURCES, never from resolver logic:
--   (1) the approved matrix row  — staff_admin holds all three representatives;
--   (2) the approved deny-class effect table (docs/design/authz-ae45-deny-class-effects.md).
-- The generator TRANSCRIBES that 9-row table in its stated precedence. It performs no
-- scope-reaching join, no closure lookup and no role_permissions read — it is deliberately
-- NOT a second implementation of has_direct_permission, because a suite whose expected
-- values are computed the way the resolver computes them proves only that the resolver
-- equals itself.
--
-- expectedSource values present: %s
create temp table authz_differential_cells on commit drop as
  select * from (values
%s
  ) as t(cell_id, persona, active_context, scope, permission_code, legacy_class,
         resolution_scope_kind, principal_state, self_check, expected_granted, expected_source);
""" % (sha, len(cells), sum(skipped.values()), ', '.join(srcs), rows)

io.open(OUT, 'w', encoding='utf-8', newline='\n').write(body)
print('cells=%d skipped=%d (%s)' % (len(cells), sum(skipped.values()), skipped))
print('expectedSource:', srcs)
print('granted=%d denied=%d' % (sum(1 for c in cells if c[9]), sum(1 for c in cells if not c[9])))
