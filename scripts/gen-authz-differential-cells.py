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
    MANIFEST_PERMISSIONS = json.loads(io.open(MANIFEST_SRC, 'rb').read().decode('utf-8'))['permissions']
except Exception as _e:                       # noqa: BLE001 — any failure here is arm9's business
    MANIFEST_PERMISSIONS, _MANIFEST_ERR = None, '%s: %s' % (type(_e).__name__, _e)

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

# ── CONDITIONAL (GATE-SCOPED) EXCLUSIONS — the same reasoned-exclusion idiom, one grain finer. ──
# EXCLUSIONS above deletes an axis value from the WHOLE population; an entry here deletes it only
# where it is INERT, and it is held to the same bar: arm7 refuses an unreasoned one, because an
# unreasoned exclusion is a default in disguise. ⛔ These are NOT axis-value keys — the second
# element is a RULE NAME, and `build()` implements the condition. The rule name is what the skip
# census counts, so the deletion is always attributable to a sentence someone wrote.
CONDITIONAL_EXCLUSIONS = {
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
assert len(subject_roles) == 1, 'AE4 substitutes exactly ONE role (ADR 0155 D7); got %s' % subject_roles
SUBJECT_ROLE = subject_roles[0]


def expected(persona, ctx, scope, state, selfcheck, res_scope):
    """EXPECTED VALUES COME FROM EXACTLY TWO HAND-ENCODED SOURCES — never resolver logic.
       (1) the approved matrix row: staff_admin holds EVERY code in REPS — after AE4.7c that is
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
        '⭐ THE CONTROL FOR THE CLASS-5 BUG: at a role-keyed reach the same wrong/absent hat that '
        'the deny-class table denies on ALSO shuts arm 3 — which is what grant_keyed does not do',
    'arm3:masking':
        '⚠ arm 3 AGREES with an expected GRANT and masks the arm the cell names',
    'arm3:divergent-approved:not-a-holder':
        'arm 3 grants where the table denies — PO-APPROVED (R2): an explicit case grant needs no role',
    'arm3:divergent-approved:cross-org':
        'arm 3 grants where the table denies — PO-APPROVED (R2): an explicit case grant anchors on '
        'the CASE, never on the caller\'s org',
    'arm3:divergent-defective:hat-unenforceable':
        '⛔ DEFECT, NOT APPROVED REACH — BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-'
        'TERM-UNENFORCEABLE. Awaiting a fix; ⛔ never read as an approved expected value',
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
ARM3_DIVERGENT_APPROVED = ('arm3:divergent-approved:not-a-holder',
                           'arm3:divergent-approved:cross-org')


def expected_legacy(exp, div):
    """The approved answer for the LEGACY DOOR, transcribed from PO ruling R2.

       ⛔ NOT a copy of `expected_granted` with a fudge, and ⛔ not resolver logic: it is
       `expected_granted` plus exactly the divergences R2 RULED APPROVED — "the case-grant path
       deliberately anchors on the case, not on the caller's org or role. That is the whole point
       of an explicit grant." Every other cell keeps the matrix answer, so the two columns are
       identical wherever no approved divergence was ruled, and 403 §4.1 keeps comparing
       legacy against catalog on exactly those cells.

       ⛔⛔ THE FILED DEFECT IS NOT LISTED HERE, AND THAT OMISSION IS THE RULING. Class 5
       (`ARM3_PINNED_DEFECT`) keeps the matrix answer FALSE — the hat rule SHOULD deny — while
       the door returns TRUE today. Encoding today's behaviour as the approved value is the one
       thing R2 forbids, so the defect is carried as a CARVE-OUT plus a head-on assertion in
       403 §7.4 ("this is what it does, and it is wrong"), never as an expected value. When the
       bug is fixed, §7.4 reds and the assertion moves deliberately.

       ⚠ A `divergent-approved` cell always has `exp is False` BY CONSTRUCTION — arm3_divergence
       returns `arm3:masking` before it reaches the divergent branches whenever `exp` is true. So
       arm10(a) below, which requires those cells to expect a legacy GRANT, subsumes the
       "this column is just a copy of expected_granted" shape entirely, and no separate
       copy-detector is written: an arm that cannot fire on its own is the vacuity this file
       exists to refuse."""
    if div in ARM3_DIVERGENT_APPROVED:
        return True
    return exp


# ⛔ CELLS CARRYING THESE LABELS ARE NOT ARM-3 COVERAGE, and the header counts them separately so
# the number cannot be quoted as one. `blocked:principal-state` is class 1's 108 base cells: no
# fixture can make arm 3 fire there, so they measure the deny-class table and say NOTHING about
# arm 3. `not-in-gate` is a different door entirely. Counting either as arm-3 coverage would
# inflate the report with cells that cannot fail for an arm-3 reason.
NOT_ARM3_COVERAGE = ('arm3:not-in-gate', 'arm3:blocked:principal-state')


def arm3_divergence(klass, persona, ctx, scope, state, selfcheck, exp, src, reach):
    """Transcribed from the arm-3 derivation, in PRECEDENCE ORDER. Each branch names the catalog
       fact it stands for; none of them re-derives `expected_granted`."""
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

    # (6) THE THREE DIVERGENT CLASSES. ⛔ EXHAUSTIVE BY RAISE, NOT BY `else`. A new deny class
    # arriving in `expected()` must be dispositioned here deliberately; absorbing it into a
    # default would silently label an unexamined divergence as approved — the default-arm shape
    # ADR 0176 D5 retires, one layer down where no arm in this file could see it.
    if src == 'matrix-row:not-a-holder':
        return 'arm3:divergent-approved:not-a-holder'          # class 3
    if src == 'deny-class:cross_org':
        return 'arm3:divergent-approved:cross-org'             # class 4
    if src == 'deny-class:wrong_active_context:self':
        return 'arm3:divergent-defective:hat-unenforceable'    # class 5 — the filed bug
    raise AssertionError(
        'arm3_divergence has no disposition for expectedSource `%s` at reach `%s` (persona=%s '
        'ctx=%s scope=%s state=%s self=%s). A deny class reached arm 3 without a PO ruling on '
        'whether its divergence is approved or defective — rule it, do not default it.'
        % (src, reach, persona, ctx, scope, state, selfcheck))


def build(personas, contexts, scopes, states, reaches, reps, exclusions):
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
    for code, klass, res in reps:
        for persona in personas:
            for ctx in contexts:
                for scope in scopes:
                    for state in states:
                        for selfcheck in (True, False):
                          for reach in reaches:
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
                            exp, src = expected(persona, ctx, scope, state, selfcheck, res)
                            # ⛔ `reach` IS IN THE CELL ID, AND IT HAS TO BE. Without it the four
                            # reach values collapse onto ONE id, 403 reports on cell_id, and three
                            # of every four cells become an invisible duplicate of the first.
                            cid = '|'.join([persona, SUBJECT_ROLE, ctx, scope, code, state,
                                            'self' if selfcheck else 'third_party', reach])
                            div = arm3_divergence(klass, persona, ctx, scope, state,
                                                  selfcheck, exp, src, reach)
                            # ⛔ APPENDED AS THE LAST COLUMN, NOT INSERTED BESIDE `exp`. Every
                            # arm above and every --self-test fixture below addresses cells BY
                            # INDEX (c[9] is the expected value, c[12] the label); inserting a
                            # column mid-tuple would silently re-point all of them at their
                            # neighbours, which is a whole-file mutation wearing a one-line diff.
                            exp_legacy = expected_legacy(exp, div)
                            cells.append((cid, persona, ctx, scope, code, klass, res, state,
                                          selfcheck, exp, src, reach, div, exp_legacy))
    return cells, skipped


cells, skipped = build(personas, contexts, scopes, states, reaches, REPS, EXCLUSIONS)

# ⭐ THE CENSUS SUMS. Every cell of the declared grid is either emitted or attributed to exactly
# one named rule. ⛔ Without this the header's "N skipped" is a number of nothing, and a rule that
# quietly elides a coordinate twice (or not at all) is invisible.
_GRID = len(REPS) * len(personas) * len(contexts) * len(scopes) * len(states) * 2 * len(reaches)
assert len(cells) + sum(skipped.values()) == _GRID, (
    'the census does not sum: %d emitted + %d skipped != %d declared grid cells'
    % (len(cells), sum(skipped.values()), _GRID))


_UNSET = object()   # `None` is a LEGITIMATE value for `permissions` (an unreadable manifest), so
                    # the "use the real one" sentinel cannot be None — the self-test exercises both.


def coverage(cells, skipped, reps, disposition=None, exclusions=None, axes=None,
             permissions=_UNSET, conditional=None):
    """ELEVEN ARMS. ⛔ An arm that has never refused anything is a detector nobody has shown finds
       something — every one is exercised by --self-test below."""
    disposition = AXIS_DISPOSITION if disposition is None else disposition
    exclusions = EXCLUSIONS if exclusions is None else exclusions
    axes = spec['axes'] if axes is None else axes
    permissions = MANIFEST_PERMISSIONS if permissions is _UNSET else permissions
    conditional = CONDITIONAL_EXCLUSIONS if conditional is None else conditional
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
    # ⚠ THE SWEEP COVERS 5 OF THE 6 CLASSES 401 §19.2 counts (4 -> 5 at pre-AE5 Batch 10, PO
    # ruling R4). The ONE uncovered class is can_manage_professional (row 30), and the reason is
    # unchanged: staff_admin does not hold that code, so a rep on it would make every cell of the
    # class a denial — the single-polarity trap AE4.7c already hit once.
    # ⛔ can_manage_external_participant (row 31) is NO LONGER covered by body identity — it has
    # its own rep. That reduction is retired, and 403 §2.3b now asserts the rep instead of the
    # identity.
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
    # ⛔ AN AXIS MISSING FROM THIS MAP IS AN AXIS arm7 CANNOT SEE. The lookup below falls back
    # to `emitted = declared` when a swept axis has no column, so `missing` is empty by
    # construction and the arm can never fire for it — a detector that could not fail, on the very
    # axis someone just added. `role` is the ONE tolerable case: subjectRoles is asserted to hold
    # exactly one value at the top of this file, so there is nothing for the arm to find.
    # ⭐ `caseReach` -> 11 is why the reach had to become a COLUMN and not merely a cell-id suffix.
    # ⭐⭐ IT IS ALSO THE STOP ON THE GATE-SCOPED RULE, AND THE PAIRING IS DELIBERATE. That rule
    # keeps all four reaches for the arm-3 rep and one for everyone else, so `emitted` is still the
    # full declared set and arm7 stays quiet. Widen the rule by one character — drop the `klass !=
    # ARM3_GATE` guard, or point it at the wrong class — and three values appear in NO cell and in
    # NO named exclusion, which is exactly what arm7 refuses. So the saving cannot grow into a
    # silent axis deletion without this arm saying so.
    CELL_AXIS_COL = {'persona': 1, 'activeContext': 2, 'scope': 3, 'principalState': 7,
                     'caseReach': 11}
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
    if ARM3_GATE not in {r[1] for r in reps}:
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
        _absent_reps = sorted({r[0] for r in reps} - set(permissions))
        if _absent_reps:
            f.append('arm9: representative(s) %s are absent from the enforcement manifest — their '
                     '`openArms` cannot be read, so there is no authority for deleting the '
                     'caseReach coordinate from them' % ', '.join(_absent_reps))
        else:
            _armed = {klass for code, klass, _res in reps
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
    _approved_defect = [c for c in cells if c[12] == ARM3_PINNED_DEFECT and c[13]]
    if _approved_defect:
        f.append('arm10: %d cell(s) labelled `%s` expect the legacy door to GRANT — that encodes a '
                 'FILED DEFECT\'s current behaviour as the approved answer, which is the ONE thing '
                 'R2 forbids. The defect is carried as a carve-out plus 403 §7.4\'s head-on '
                 'assertion, never as an expected value (first: %s)'
                 % (len(_approved_defect), ARM3_PINNED_DEFECT, _approved_defect[0][0]))
    _unattributed = [c for c in cells
                     if c[13] != c[9] and c[12] not in ARM3_DIVERGENT_APPROVED
                     and c[12] != ARM3_PINNED_DEFECT]
    if _unattributed:
        f.append('arm10: %d cell(s) expect the legacy door to disagree with the matrix WITHOUT a '
                 'divergent label to attribute it to — 403 §4.1 excuses legacy-vs-catalog '
                 'disagreement on exactly these cells, so an unattributed flip is an exemption '
                 'nobody ruled (first: %s)' % (len(_unattributed), _unattributed[0][0]))

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
    _RENAMED = 'a_gate_with_no_case_arm'
    _repointed_reps = [(r[0], _RENAMED if r[1] == ARM3_GATE else r[1], r[2]) for r in REPS]
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
        out[i] = out[i][:13] + (value,)
        return out

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
        ('arm6 expectedSource blanked',  [c[:10] + ('',) + c[11:] for c in base_cells],          base_skipped, REPS, None, None, None),
        # ⛔ arm8's FOUR SHAPES, EACH ISOLATED. A fixture that trips a second arm proves nothing
        # about this one — the lesson arm1b's isolation note records, applied again.
        # ⚠ ONE CELL, NOT ALL OF THEM, and that is the stronger control twice over: a wholesale
        # wipe is a shape no real edit produces, AND it makes the column single-valued, so the
        # single-valued sub-check fires too and the fixture stops isolating what it names.
        ('arm8 divergence label blanked',  [base_cells[0][:12] + ('',) + base_cells[0][13:]] + base_cells[1:],        base_skipped, REPS, None, None, None),
        ('arm8 divergence label unknown',  [base_cells[0][:12] + ('arm3:a-label-nobody-declared',) + base_cells[0][13:]] + base_cells[1:],
                                                                                                 base_skipped, REPS, None, None, None),
        # A VALID vocabulary value applied to every cell: blank and unknown both pass, only the
        # single-valued check can fire. ⚠ It also trips arm10 since increment 3, and correctly:
        # wiping the labels strands every approved legacy GRANT with nothing to attribute it to,
        # which is exactly arm10(e). Named here rather than silenced.
        ('arm8 divergence column collapsed', [c[:12] + ('arm3:not-in-gate',) + c[13:] for c in base_cells], base_skipped, REPS, None, None, None),
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
         REPS + [('org.professionals.manage', 'is_staff_admin_of_for', 'commission')], None, None, None),
        # ⛔ arm7's THREE shapes. The first is the live defect it was resurrected for: a value the
        # axes file declares that the loop never reaches. Note the cells are the REAL ones — that
        # is the point, arm7 must fire on a cell set every other arm calls clean.
        ('arm7 axis value dropped silently', base_cells, base_skipped, REPS, None, EXCLUSIONS, ax_extra_value),
        ('arm7 axis with no disposition',    base_cells, base_skipped, REPS, None, EXCLUSIONS, ax_extra_axis),
        ('arm7 exclusion with no reason',    base_cells, base_skipped, REPS, None,
         {**EXCLUSIONS, ('principalState', 'offboarded'): ''}, None),
        # ⛔ THE SAME BAR, ON THE GATE-SCOPED DICT. Without this fixture arm7's reason check would
        # be exercised only on the value exclusions, and the conditional rules — the ones that
        # delete 2592 cells — would be held to a bar nobody had ever seen refuse anything.
        ('arm7 conditional exclusion with no reason', base_cells, base_skipped, REPS, None, None, None,
         _UNSET, {('caseReach', 'inert_outside_the_arm3_gate'): ''}),
        # ⭐ arm9's FOUR SHAPES. Cells and REPS are the REAL ones in all four — that is the point:
        # the arm must fire on a population every other arm calls clean, because the defect it
        # detects lives in the AUTHORITY for the population, not in the population.
        ('arm9 a second rep grows the case arm',   base_cells, base_skipped, REPS, None, None, None, _pm_two_armed),
        ('arm9 the arm-3 rep loses the case arm',  base_cells, base_skipped, REPS, None, None, None, _pm_disarmed),
        ('arm9 the arm-3 rep left the manifest',   base_cells, base_skipped, REPS, None, None, None, _pm_rep_absent),
        ('arm9 the manifest is unreadable',        base_cells, base_skipped, REPS, None, None, None, None),
        # ⭐ arm10's THREE SHAPES, EACH PERTURBING ONE CELL so the sub-check under test is the only
        # one that can fire. ⛔ `_one` rewrites the FIRST cell carrying the label the fixture is
        # about — never a positional index into base_cells, which would silently stop selecting a
        # labelled cell the moment the emission order changed and report NOT CAUGHT for a reason
        # that has nothing to do with the arm.
        ('arm10 approved divergence demoted', _one(ARM3_DIVERGENT_APPROVED, False), base_skipped, REPS, None, None, None),
        ('arm10 filed defect approved',       _one((ARM3_PINNED_DEFECT,), True),     base_skipped, REPS, None, None, None),
        # A flip with no divergent label at all: the `caps-deny` cells are the honest non-vacuous
        # denials, so promoting one is exactly the unattributed exemption (e) exists to refuse.
        ('arm10 unattributed legacy flip',    _one(('arm3:silent:caps-deny',), True), base_skipped, REPS, None, None, None),
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
b = lambda x: 'true' if x else 'false'
rows = ',\n'.join(
    '    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
        q(c[0]), q(c[1]), q(c[2]), q(c[3]), q(c[4]), q(c[5]), q(c[6]), q(c[7]),
        b(c[8]), b(c[9]), q(c[10]), q(c[11]), q(c[12]), b(c[13]))
    for c in cells)

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
npin = _div_census.get(ARM3_PINNED_DEFECT, 0)
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
-- ⛔ THE FILED DEFECT IS PINNED, NOT APPROVED. `%s` keeps
-- `expected_legacy_granted = false` — the approved answer, because the hat rule SHOULD deny —
-- while the door returns TRUE today. Those %d cells are the ONLY cells excused from §4.1/§4.1b,
-- by that label alone, and 403 §7.4 asserts head-on that every one of them GRANTS and that
-- granting is WRONG. The day the bug is fixed, §7.4 reds: the assertion moves DELIBERATELY
-- instead of tracking reality. arm10 refuses any attempt to launder it into an expected value.
--
-- ══ WHERE THE TWO EXPECTED VALUES DIVERGE (%d cell(s)) ═══════════════════════════════════════
%s
--
-- ⛔ `divergent-approved` (R2: an explicit case grant needs no role and anchors on the CASE, not
-- the caller's org) and `divergent-defective` (BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-
-- THE-HAT-TERM-UNENFORCEABLE) ARE DIFFERENT VALUES ON PURPOSE. Merging them would encode a filed
-- defect's current behaviour as approved, which is the one thing R2 forbids.
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
create temp table authz_differential_cells on commit drop as
  select * from (values
%s
  ) as t(cell_id, persona, active_context, scope, permission_code, legacy_class,
         resolution_scope_kind, principal_state, self_check, expected_granted, expected_source,
         case_reach, arm3_divergence, expected_legacy_granted);
""" % (sha, len(cells), len({r[1] for r in REPS}), len(REPS), sum(skipped.values()),
       excl, ', '.join(srcs), ARM3_PINNED_DEFECT, npin, nflip, flips,
       len(cells) - notcov, notcov, ARM3_GATE, condexcl, divcensus, rows)

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
print('legacy_granted=%d denied=%d  (flips vs expected_granted: %d, pinned defect: %d)'
      % (sum(1 for c in cells if c[13]), sum(1 for c in cells if not c[13]), nflip, npin))
