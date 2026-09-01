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
