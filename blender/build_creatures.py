"""
build_creatures.py — models every creature and both bosses in Blender, each with its own
skeleton, saves blender/<id>.blend and exports js/models/<id>.js (PINEWOOD_MODELS.<id>).
js/creatures.js and js/bosses.js build each creature from its model and animate its bones.

  blender-launcher --background --factory-startup --python blender\\run.py -- build_creatures
  (one creature only: add its id after the script name, e.g.  -- build_creatures imp)

!! Like build_ranger.py, this rebuilds from scratch and OVERWRITES the .blend files. Once you
!! edit a creature by hand in Blender, re-export just that one: blender\\export_model.cmd imp

HOW EACH CREATURE IS BUILT
  - Parts are modeled in game space (feet at y = 0, facing +Z, its left +X), low-poly and
    flat-shaded (pwkit.py): lofted bodies, swept limbs, Skin-modifier horns, antlers and roots.
  - Every part is rigid on ONE bone (its joint), so limbs bend at real joints: knees, elbows,
    jaws, tail segments. The bones are what the game animates.
  - The root bone is always "body" (the game leans it into attacks).
  - Glowing materials (eyes, embers, crystals) have "emit" set; the game doesn't flash those
    red when the creature is hit.
"""
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pinewood_export
from pwkit import *

set_log('build_creatures')

# ---------------------------------------------------------------------------
# Small shape helpers on top of pwkit (tube, spike, blob, egg, hoop live in pwkit itself)
# ---------------------------------------------------------------------------
V = Vector
SIDES = [('L', 1), ('R', -1)]

def rose(bm, at, out, s=1.0):
    """A low-poly rose: a bud with six cupped petals around it, facing `out`."""
    q = aim(out)
    c = V(at)
    blob(bm, c, 0.07 * s, 0.06 * s, 0.07 * s, 6, 4, q)
    for k in range(6):
        a = k / 6 * math.pi * 2
        off = (q @ V((math.cos(a) * 0.08 * s, -0.02 * s, math.sin(a) * 0.08 * s, 0))).to_3d()
        blob(bm, c + off, 0.075 * s, 0.03 * s, 0.075 * s, 6, 3, q @ rot_xyz(-math.sin(a) * 0.6, 0, math.cos(a) * 0.6))

def B(name, parent, head, tail=None):
    """A bone: name, parent, head (game space); the tail defaults to just above the head."""
    head = tuple(head)
    return (name, parent, head, tail or (head[0], head[1] + 0.08, head[2]))

def finish(name, bones, info=None):
    """Rig every part (all rigid), save <name>.blend and export js/models/<name>.js."""
    rig(name + 'Rig', bones, None, (), info or {})
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, name + '.blend'), check_existing=False)
    pinewood_export.export(name, log=log)

# ---------------------------------------------------------------------------
# Bramble imp: a gaunt, hunched bramble ghoul. A starved torso with its ribs showing and
# thorns down its spine; a long skull-like head with four sunken glowing eyes, swept-back
# horns and a hinged jaw of needle teeth; long spindly arms ending in claws that nearly drag
# on the ground; backward-bending (digitigrade) legs; a thorny whip of a tail.
# ---------------------------------------------------------------------------
def imp():
    palette([('impSkin', '2a1a26', 0.8), ('sinew', '5a3444', 0.75), ('thorn', '150c12'), ('eyeAmber', 'ffb43a', 0.5, 0, 1.0),
             ('void', '050304'), ('tooth', 'd8ccb0', 0.6)])
    SP = [V((0, 0.62, -0.03)), V((0, 0.76, 0.05)), V((0, 0.9, 0.15)), V((0, 0.98, 0.26))]   # the hunched spine, hips to neck
    single('Torso', 'impSkin', 'torso', lambda bm: sweep(bm, SP, [0.08, 0.12, 0.13, 0.085], 7, up=(1, 0, 0)))
    def ribs(bm):   # starved ribs showing through the skin, and thorns down the spine
        for t, r in ((0.42, 0.135), (0.56, 0.14), (0.7, 0.13), (0.84, 0.115)):
            i = min(2, int(t * 3)); f = t * 3 - i
            c = SP[i].lerp(SP[i + 1], f)
            hoop(bm, c, r, 0.016, 10, 4, up=tuple((SP[i + 1] - SP[i]).normalized()))
    single('Ribs', 'sinew', 'torso', ribs)
    single('SpineThorns', 'thorn', 'torso', lambda bm: [spike(bm, SP[i].lerp(SP[i + 1], f) + V((0, 0.1, -0.07)), (0, 0.7, -1), 0.03, 0.14 + f * 0.06, 4) for i in range(3) for f in (0.2, 0.7)])
    HC = V((0, 1.02, 0.36))   # the head: a long skull, low and thrust forward
    def head(bm):
        loft(bm, [face_ring(HC.z + z, HC.y + dy, w, t, b) for z, dy, w, t, b in
                  [(-0.12, 0.02, 0.07, 0.08, 0.07), (-0.05, 0.03, 0.12, 0.12, 0.09), (0.04, 0.01, 0.13, 0.11, 0.06), (0.12, -0.02, 0.1, 0.07, 0.04), (0.21, -0.04, 0.055, 0.04, 0.03)]])
    hd = single('Head', 'impSkin', 'head', head)
    T = bvh(hd)
    EYES = []
    for s in (-1, 1):   # two big sunken eyes and two small ones above them
        p, n = surf(T, (s * 0.06, HC.y + 0.05, 2), (0, 0, -1)); EYES.append((p, n, 0.034))
        p, n = surf(T, (s * 0.085, HC.y + 0.1, 2), (0, 0, -1)); EYES.append((p, n, 0.02))
    single('Sockets', 'void', 'head', lambda bm: [blob(bm, p - n * 0.006, r * 1.3, r * 0.9, r * 0.6, 6, 4, aim(n)) for p, n, r in EYES])
    single('Eyes', 'eyeAmber', 'head', lambda bm: [blob(bm, p + n * 0.004, r * 0.85, r * 0.7, r * 0.45, 5, 3) for p, n, r in EYES])
    def upper_teeth(bm):
        for i in range(9):   # a long grin of needle teeth
            x = (i - 4) * 0.022
            spike(bm, HC + V((x, -0.05, 0.19 - abs(x) * 1.4)), (0, -1, 0.15), 0.008, 0.06, 3)
    single('UpperTeeth', 'tooth', 'head', upper_teeth)
    for k, s in SIDES:   # horns swept back
        skin_tree('Horn' + k, 'thorn', 'head', {'a': (HC + V((s * 0.07, 0.1, -0.04)), 0.03), 'b': (HC + V((s * 0.14, 0.2, -0.16)), 0.018), 'c': (HC + V((s * 0.12, 0.27, -0.33)), 0.005)},
                  [('a', 'b'), ('b', 'c')], 'a')
    def jaw(bm):
        loft(bm, [face_ring(HC.z + z, HC.y - 0.07, w, 0.02, 0.035) for z, w in ((-0.04, 0.1), (0.08, 0.08), (0.2, 0.04))])
        for i in range(7):
            x = (i - 3) * 0.024
            spike(bm, HC + V((x, -0.06, 0.17 - abs(x) * 1.4)), (0, 1, 0.1), 0.008, 0.05, 3)
    single('Jaw', 'impSkin', 'jaw', jaw)
    bones = [B('body', None, (0, 0.62, 0)), B('torso', 'body', (0, 0.76, 0.05)), B('head', 'torso', (0, 0.98, 0.26)), B('jaw', 'head', HC + V((0, -0.06, -0.08))),
             B('tail', 'body', (0, 0.64, -0.1))]
    for k, s in SIDES:
        S, E, W = V((s * 0.15, 0.94, 0.2)), V((s * 0.3, 0.64, 0.34)), V((s * 0.34, 0.34, 0.46))
        single('Upper' + k, 'impSkin', 'arm' + k, lambda bm: (tube(bm, S, E, 0.035, 0.026), blob(bm, E, 0.032, 0.032, 0.032, 6, 4)))
        def fore(bm):
            tube(bm, E, W, 0.026, 0.02)
            for f in (0.3, 0.6):
                spike(bm, E.lerp(W, f), (s, -0.3, 0.2), 0.012, 0.07, 3)
            # the hand: a bony wrist knob and a narrow palm running from the forearm's end down to the
            # knuckles, so the claws grow straight out of the arm
            blob(bm, W, 0.026, 0.026, 0.026, 6, 4)
            tube(bm, W, W + V((0, -0.085, 0.05)), 0.024, 0.03, 6)
            blob(bm, W + V((0, -0.085, 0.05)), 0.045, 0.022, 0.03, 6, 3)
        single('Fore' + k, 'impSkin', 'fore' + k, fore)
        nodes = {'w': (W + V((0, -0.06, 0.035)), 0.02)}
        for i, dx in enumerate((-0.035, 0.0, 0.035)):   # three long clawed fingers from the knuckles
            nodes['k%d' % i] = (W + V((s * dx, -0.09, 0.055)), 0.014)
            nodes['t%d' % i] = (W + V((s * dx * 1.6, -0.27, 0.13)), 0.003)
        skin_tree('Claws' + k, 'thorn', 'fore' + k, nodes, [('w', 'k%d' % i) for i in range(3)] + [('k%d' % i, 't%d' % i) for i in range(3)], 'w', False)
        H, K, A = V((s * 0.1, 0.62, -0.02)), V((s * 0.13, 0.4, 0.14)), V((s * 0.13, 0.13, -0.08))
        single('Thigh' + k, 'impSkin', 'leg' + k, lambda bm: (tube(bm, H, K, 0.05, 0.034), blob(bm, K, 0.036, 0.036, 0.036, 6, 4)))
        single('Shin' + k, 'impSkin', 'shin' + k, lambda bm: (tube(bm, K, A, 0.032, 0.022), spike(bm, K.lerp(A, 0.4), (0, 0.2, 1), 0.012, 0.07, 3)))
        single('Foot' + k, 'thorn', 'foot' + k, lambda bm: (tube(bm, A, A + V((0, -0.11, 0.08)), 0.02, 0.016), [spike(bm, A + V((0, -0.11, 0.08)), (a, -0.25, 1), 0.012, 0.09, 3) for a in (-0.5, 0, 0.5)]))
        bones += [B('arm' + k, 'torso', S), B('fore' + k, 'arm' + k, E), B('leg' + k, 'body', H), B('shin' + k, 'leg' + k, K), B('foot' + k, 'shin' + k, A)]
    skin_tree('Tail', 'thorn', 'tail', {'a': ((0, 0.64, -0.1), 0.035), 'b': ((0, 0.5, -0.35), 0.025), 'c': ((0, 0.58, -0.6), 0.015), 'd': ((0, 0.74, -0.72), 0.004),
                                         't1': ((0.06, 0.56, -0.42), 0.003), 't2': ((-0.06, 0.62, -0.62), 0.003)},
              [('a', 'b'), ('b', 'c'), ('c', 'd'), ('b', 't1'), ('c', 't2')], 'a', False)
    finish('imp', bones)

# ---------------------------------------------------------------------------
# Gloom wisp: a wraith. A deep tattered hood with a pale skull inside (glowing eyes, a jaw that
# drops as it charges a bolt), skeletal clawed arms reaching out, a shroud that hangs in ragged
# strips and trails off into wisps, and violet soul-crystals circling it.
# ---------------------------------------------------------------------------
def wisp():
    palette([('shroud', '231c30', 0.85), ('shroudDark', '15111e', 0.9), ('bone', 'cfc6d8', 0.7), ('void', '050304'), ('eyePale', 'e6d6ff', 0.4, 0, 1.0),
             ('crystal', '8a6cff', 0.2, 0.3, 0.45)])
    Y = 1.45
    HD = V((0, Y + 0.08, 0.02))
    def hood(bm):   # a deep cowl, open at the front, peaked at the back
        loft(bm, [face_ring(HD.z + z, HD.y + dy, w, t, b) for z, dy, w, t, b in
                  [(-0.3, 0.02, 0.1, 0.14, 0.14), (-0.18, 0.04, 0.24, 0.28, 0.22), (0.0, 0.04, 0.29, 0.31, 0.26), (0.17, 0.02, 0.27, 0.3, 0.27)]], True, False)
        spike(bm, HD + V((0, 0.24, -0.26)), (0, 0.5, -1), 0.11, 0.32, 5)
    single('Hood', 'shroud', 'body', hood)
    single('HoodDark', 'void', 'body', lambda bm: blob(bm, HD + V((0, 0.0, 0.0)), 0.25, 0.27, 0.2, 8, 5))   # the darkness inside
    single('Skull', 'bone', 'body', lambda bm: (egg(bm, HD + V((0, 0.02, 0.1)), 0.13, 0.15, 0.12, 8, 5), tube(bm, HD + V((0, -0.04, 0.15)), HD + V((0, -0.08, 0.24)), 0.07, 0.045, 6)))
    single('Sockets', 'void', 'body', lambda bm: [blob(bm, HD + V((s * 0.055, 0.04, 0.2)), 0.045, 0.04, 0.03, 6, 4) for s in (-1, 1)])
    single('Eyes', 'eyePale', 'body', lambda bm: [blob(bm, HD + V((s * 0.055, 0.04, 0.222)), 0.028, 0.022, 0.014, 5, 3) for s in (-1, 1)])
    single('Jaw', 'bone', 'jaw', lambda bm: (tube(bm, HD + V((0, -0.1, 0.1)), HD + V((0, -0.14, 0.22)), 0.06, 0.04, 6),
                                             [spike(bm, HD + V((x, -0.11, 0.21)), (0, 1, 0.1), 0.01, 0.04, 3) for x in (-0.025, 0, 0.025)]))
    def shroud(bm):   # the upper shroud, flaring and ragged at its hem
        hem = [(x, y - (0.12 if i % 2 else 0), z) for i, (x, y, z) in enumerate(round_ring(0, Y - 0.6, -0.08, 0.34, 12))]
        loft(bm, [round_ring(0, Y - 0.1, -0.02, 0.22, 12), round_ring(0, Y - 0.35, -0.05, 0.3, 12), hem], False, False)
    single('Shroud', 'shroud', 'tail1', shroud)
    def strips(bm):   # ragged strips hanging from the hem
        for i in range(9):
            a = i / 9 * math.pi * 2
            top = V((math.sin(a) * 0.3, Y - 0.62, -0.1 + math.cos(a) * 0.3))
            ln = 0.3 + (i % 3) * 0.1
            prism(bm, [(-0.07, 0), (0.07, 0), (0.0, -ln)], 0.012, top, (0, a, 0))   # a long tattered triangle, facing out
    single('Strips', 'shroudDark', 'tail2', strips)
    def wisps(bm):    # the shroud trailing off into wisps of shadow
        for i in range(4):
            a = i / 4 * math.pi * 2 + 0.4
            top = V((math.sin(a) * 0.18, Y - 0.95, -0.2 + math.cos(a) * 0.15))
            sweep(bm, [top, top + V((math.sin(a) * 0.05, -0.2, -0.08)), top + V((math.sin(a) * 0.02, -0.42, -0.2))], [0.06, 0.035, 0.004], 4)
    single('Wisps', 'shroudDark', 'tail3', wisps)
    bones = [B('body', None, (0, Y, 0)), B('jaw', 'body', HD + V((0, -0.08, 0.08))), B('orbit', 'body', (0, Y, 0)),
             B('tail1', 'body', (0, Y - 0.1, -0.02)), B('tail2', 'tail1', (0, Y - 0.6, -0.08)), B('tail3', 'tail2', (0, Y - 0.95, -0.2))]
    for k, s in SIDES:   # skeletal arms reaching out of the shroud, long clawed fingers
        S, E, W = V((s * 0.22, Y - 0.12, 0.05)), V((s * 0.36, Y - 0.32, 0.24)), V((s * 0.38, Y - 0.28, 0.48))
        single('Sleeve' + k, 'shroud', 'arm' + k, lambda bm: tube(bm, S, S.lerp(E, 0.7), 0.08, 0.06, 6))
        single('Arm' + k, 'bone', 'arm' + k, lambda bm: (tube(bm, S.lerp(E, 0.6), E, 0.022, 0.018, 5), blob(bm, E, 0.022, 0.022, 0.022, 5, 3), tube(bm, E, W, 0.018, 0.014, 5),
                                                          [spike(bm, W, (s * a * 0.6, -0.2, 1), 0.008, 0.15, 3) for a in (-0.5, -0.15, 0.15, 0.5)]))
        bones.append(B('arm' + k, 'body', S))
    single('Orbit', 'crystal', 'orbit', lambda bm: [blob(bm, (math.cos(a) * 0.65, Y + (k - 1) * 0.15, math.sin(a) * 0.65), 0.05, 0.12, 0.05, 4, 2) for k, a in enumerate((0, 2.094, 4.189))])
    finish('wisp', bones)

# ---------------------------------------------------------------------------
# Hollow stump: a rotting trunk split by a tall maw ringed with splinter teeth (its lower jaw
# drops open), five mismatched ember eyes set into the bark (each on its own bone so they blink
# one at a time), dead moss hanging in strands round its back and sides, pale shelf fungus, long
# root-tendril arms with many twig fingers, and root feet.
# ---------------------------------------------------------------------------
def stump():
    palette([('bark', '3a2a1e'), ('barkDark', '211710'), ('moss', '5a6040', 0.95), ('fungus', 'd8ccaa', 0.7), ('void', '050304'),
             ('ember', 'ff4a2a', 0.5, 0, 1.0), ('woodTooth', '9a8460')])
    rnd = random.Random(5)
    def rotted(y, r, n=12):   # a gnarled cross-section: bark ridges and lumps
        return [(math.sin(i * 2 * math.pi / n) * r * (1.0 if i % 2 else 0.88) * (0.95 + rnd.random() * 0.1), y,
                 math.cos(i * 2 * math.pi / n) * r * (1.0 if i % 2 else 0.88) * (0.95 + rnd.random() * 0.1)) for i in range(n)]
    tr = single('Trunk', 'bark', 'body', lambda bm: loft(bm, [rotted(0.3, 0.52), rotted(0.6, 0.5), rotted(0.95, 0.47), rotted(1.25, 0.44)], True, False))
    T = bvh(tr)   # eyes are raycast onto this, so they sit right on the bark
    def splinters(bm):   # a crown of broken splinters, some tall
        for i in range(11):
            a = i / 11 * math.pi * 2 + 0.3
            spike(bm, (math.sin(a) * 0.38, 1.22, math.cos(a) * 0.38), (math.sin(a) * 0.3, 1, math.cos(a) * 0.3), 0.08, 0.18 + rnd.random() * 0.35, 4)
    single('Splinters', 'bark', 'body', splinters)
    single('Hollow', 'barkDark', 'body', lambda bm: cyl(bm, 0.36, 0.36, 0.03, 12, place((0, 1.24, 0))))   # the rotten-out top
    single('Maw', 'void', 'body', lambda bm: blob(bm, (0, 0.74, 0.43), 0.13, 0.25, 0.07, 8, 6))           # a tall split down the front
    single('MawGlow', 'ember', 'body', lambda bm: box(bm, (0.05, 0.3, 0.01), (0, 0.74, 0.44)))           # fire deep inside it
    def upper_teeth(bm):   # splinters jutting in from both sides and down from the top of the maw
        for i in range(5):
            y = 0.92 - i * 0.07
            for s in (-1, 1):
                spike(bm, (s * 0.12, y, 0.47), (-s, -0.3, 0.1), 0.02, 0.08 + (i % 2) * 0.03, 3)
        for x in (-0.05, 0.0, 0.05):
            spike(bm, (x, 0.98, 0.47), (0, -1, 0.1), 0.022, 0.1, 3)
    single('Teeth', 'woodTooth', 'body', upper_teeth)
    def jaw(bm):   # the lower lip of the maw, with splinters pointing up; it drops to bite
        box(bm, (0.3, 0.08, 0.1), (0, 0.5, 0.45), (0.15, 0, 0), 0.02)
        for x in (-0.09, -0.03, 0.03, 0.09):
            spike(bm, (x, 0.54, 0.48), (0, 1, 0.15), 0.02, 0.09, 3)
    single('Jaw', 'bark', 'jaw', jaw)
    # Five mismatched, staring eyes around the top of the maw, all clear of the teeth, splinters and moss.
    # Each is raycast onto the bark; its dark socket stays on the trunk while the glowing eye is on its
    # own bone (eye0..eye4), which the game squashes shut to blink each one on its own.
    EYE_SPOTS = [((0.17, 1.1), 0.05), ((-0.15, 1.14), 0.042), ((0.02, 1.18), 0.03), ((-0.26, 0.98), 0.03), ((0.28, 0.93), 0.032)]
    EYES = [(*surf(T, (x, y, 2), (0, 0, -1)), r) for (x, y), r in EYE_SPOTS]
    single('Sockets', 'void', 'body', lambda bm: [blob(bm, p + n * 0.004, r * 1.8, r * 0.45, r * 1.55, 7, 4, aim(n)) for p, n, r in EYES])
    bones = [B('body', None, (0, 0.34, 0)), B('jaw', 'body', (0, 0.55, 0.38))]
    for i, (p, n, r) in enumerate(EYES):
        single('Eye%d' % i, 'ember', 'eye%d' % i, lambda bm: blob(bm, p + n * (r * 0.25), r * 1.15, r * 0.5, r * 1.05, 7, 4, aim(n)))
        bones.append(B('eye%d' % i, 'body', p + n * (r * 0.25)))
    def moss(bm):   # dead moss hanging in strands from the rim, round the back and sides (never over the face)
        for i in range(14):
            a = i / 14 * math.pi * 2
            if math.cos(a) > 0.35:
                continue
            top = V((math.sin(a) * 0.45, 1.2, math.cos(a) * 0.45))
            ln = 0.2 + rnd.random() * 0.3
            sweep(bm, [top, top + V((math.sin(a) * 0.04, -ln * 0.5, math.cos(a) * 0.04)), top + V((math.sin(a) * 0.03, -ln, math.cos(a) * 0.03))], [0.02, 0.014, 0.004], 4)
    single('Moss', 'moss', 'body', moss)
    single('Fungus', 'fungus', 'body', lambda bm: [blob(bm, (math.sin(a) * 0.5, y, math.cos(a) * 0.5), 0.13, 0.025, 0.09, 7, 3, (0, a, 0)) for a, y in ((1.9, 0.7), (2.2, 0.82), (-2.0, 0.55), (3.0, 0.95), (-2.6, 0.9))])
    for k, s in SIDES:   # long root-tendril arms, the hands a fan of twig fingers
        S, E, W = V((s * 0.42, 1.0, 0.05)), V((s * 0.72, 0.76, 0.15)), V((s * 0.84, 0.44, 0.26))
        skin_tree('Arm' + k, 'bark', 'arm' + k, {'s': (S, 0.075), 'e': (E, 0.05)}, [('s', 'e')], 's', False)
        nodes = {'e': (E, 0.048), 'w': (W, 0.034)}
        for i in range(5):
            a = (i - 2) * 0.35
            nodes['f%d' % i] = (W + V((s * math.sin(a) * 0.12, -0.22 - abs(a) * 0.05, 0.08 + math.cos(a) * 0.04)), 0.008)
        skin_tree('Hand' + k, 'bark', 'hand' + k, nodes, [('e', 'w')] + [('w', 'f%d' % i) for i in range(5)], 'e', False)
        L = V((s * 0.2, 0.34, 0))
        nodes = {'h': (L + V((0, 0.02, 0)), 0.12), 'f': (L + V((0, -0.28, 0.02)), 0.13)}
        for i in range(5):
            a = i / 5 * math.pi * 2 + 0.3
            nodes['r%d' % i] = (L + V((math.sin(a) * 0.24, -0.34, math.cos(a) * 0.24)), 0.025)
        skin_tree('Leg' + k, 'barkDark', 'leg' + k, nodes, [('h', 'f')] + [('f', 'r%d' % i) for i in range(5)], 'h', False)
        bones += [B('arm' + k, 'body', S), B('hand' + k, 'arm' + k, E), B('leg' + k, 'body', L)]
    finish('stump', bones)

# ---------------------------------------------------------------------------
# Mossback: a hulking boulder beast the cult chained and branded. A stone body with plates down
# its spine and lava glowing through its cracks; a mossy back with ferns and hanging dead moss;
# rusted chains wrapped round it and broken shackles on its wrists, chain ends dangling; the
# Hollow King's sigil burned glowing into its brow; a heavy head with a lava-lit maw and tusks.
# ---------------------------------------------------------------------------
def mossback():
    palette([('stone', '5a5b52'), ('stoneDark', '444640'), ('moss', '4a6a32'), ('deadMoss', '5a5a3a', 0.95), ('fern', '3f6a2a'), ('lava', 'ff6a2a', 0.5, 0, 1.0),
             ('tusk', 'd8ccb0', 0.7), ('eyeOrange', 'ff8a1c', 0.5, 0, 1.0), ('iron', '8a5a3a', 0.55, 0.5)])
    rnd = random.Random(21)
    def torso(bm):   # a boulder lofted front to back: high humped back, chest dropping to the arms
        loft(bm, [face_ring(z, y, w, t, b) for z, y, w, t, b in [(-0.9, 1.0, 0.45, 0.4, 0.35), (-0.6, 1.08, 0.95, 0.72, 0.6), (-0.15, 1.1, 1.15, 0.85, 0.72),
                                                                (0.3, 1.05, 1.08, 0.8, 0.7), (0.65, 0.98, 0.8, 0.55, 0.55), (0.85, 0.95, 0.45, 0.35, 0.35)]])
        for i, z in enumerate((0.45, 0.15, -0.15, -0.45, -0.72)):   # stone plates down the spine
            prism(bm, [(-0.05, 0.0), (0.05, 0.0), (0.0, 0.42 - i * 0.05)], 0.3 - i * 0.03, (0, 1.8 - abs(z + 0.15) * 0.25, z), (0, math.pi / 2, -0.35))
    T = bvh(single('Torso', 'stone', 'body', torso))
    def on_body(c, d, out=0.0):   # the point where a ray from inside the body along d leaves its surface (pushed out a little)
        d = V(d).normalized()
        return surf(T, c, d)[0] + d * out
    single('Moss', 'moss', 'body', lambda bm: (egg(bm, (0, 1.72, -0.15), 0.85, 0.22, 0.75, 10, 5, 1.0, 0.4), [blob(bm, (s * 0.95, 1.55, 0.2), 0.3, 0.12, 0.3, 6, 3) for s in (-1, 1)]))
    def ferns(bm):
        for x, y, z in ((-0.4, 1.86, -0.3), (0.38, 1.84, -0.5), (0.12, 1.9, 0.1), (-0.2, 1.8, -0.75)):
            for k in range(5):
                b = k / 5 * math.pi * 2 + x
                prism(bm, [(-0.035, 0), (0.035, 0), (0.0, 0.5)], 0.01, (x, y, z), aim((math.cos(b) * 0.8, 1, math.sin(b) * 0.8)))
    single('Ferns', 'fern', 'body', ferns)
    def dead_moss(bm):   # dead moss hanging in strands from its flanks and belly
        for i in range(16):
            a = i / 16 * math.pi * 2
            if math.sin(a) > 0.75:
                continue   # not over its face
            top = on_body((0, 0.85 + rnd.random() * 0.15, -0.1), (math.cos(a), -0.05, math.sin(a) * 0.8), 0.02)
            ln = 0.25 + rnd.random() * 0.3
            sweep(bm, [top, top + V((0, -ln * 0.5, 0.02)), top + V((0.02, -ln, 0))], [0.025, 0.016, 0.004], 4)
    single('DeadMoss', 'deadMoss', 'body', dead_moss)
    def cracks(bm):   # lava glowing through cracks all over its flanks, set into the surface
        for s in (-1, 1):
            for dy, z, ln, rx, rz in ((0.0, 0.15, 0.55, 0.4, 0.3), (-0.35, -0.45, 0.4, -0.5, 0.6), (0.25, -0.35, 0.3, 0.2, -0.4), (0.6, 0.3, 0.35, 0.8, 0.2), (0.3, 0.45, 0.3, -0.3, 0.5)):
                box(bm, (0.06, ln, 0.06), on_body((0, 1.05, z), (s, dy, 0)), (rx, 0, s * rz))
    single('Cracks', 'lava', 'body', cracks)
    def chains(bm):   # rusted chains wrapped round its body (chunky links), lying on the surface
        for zc, tilt in ((0.15, 0.2), (-0.45, -0.25)):
            for i in range(22):
                a = i / 22 * math.pi * 2
                p = on_body((0, 1.1, zc), (math.cos(a), math.sin(a), math.sin(a) * tilt), 0.03)
                hoop(bm, p, 0.08, 0.028, 6, 3, up=(0, 0, 1) if i % 2 else (math.cos(a), math.sin(a), 0))
    single('Chains', 'iron', 'body', chains)
    def head(bm):    # a blocky head under a heavy brow
        loft(bm, [face_ring(z, y, w, t, b) for z, y, w, t, b in [(0.6, 0.95, 0.3, 0.25, 0.22), (0.85, 0.92, 0.36, 0.26, 0.2), (1.08, 0.88, 0.3, 0.2, 0.15), (1.2, 0.86, 0.2, 0.13, 0.1)]])
        box(bm, (0.64, 0.13, 0.22), (0, 1.12, 1.0), (0.3, 0, 0), 0.03)
    single('Head', 'stone', 'head', head)
    def brand(bm):   # the Hollow King's sigil burned into its brow: a ring, antlers and a crown
        c = V((0, 1.2, 1.07))
        hoop(bm, c, 0.08, 0.012, 10, 3, up=(0, 0.3, 1))
        for s in (-1, 1):
            sweep(bm, [c + V((s * 0.02, 0.0, 0.005)), c + V((s * 0.06, 0.05, 0.0)), c + V((s * 0.1, 0.11, -0.02))], 0.01, 3, up=(0, 0, 1))
    single('Brand', 'lava', 'head', brand)
    single('Eyes', 'eyeOrange', 'head', lambda bm: [box(bm, (0.13, 0.06, 0.04), (s * 0.17, 0.98, 1.17), (0, 0, s * 0.25)) for s in (-1, 1)])
    single('Maw', 'lava', 'head', lambda bm: box(bm, (0.38, 0.07, 0.05), (0, 0.79, 1.17)))
    single('Jaw', 'stoneDark', 'jaw', lambda bm: box(bm, (0.5, 0.16, 0.38), (0, 0.69, 1.0), (-0.1, 0, 0), 0.03))
    single('Tusks', 'tusk', 'jaw', lambda bm: [(tube(bm, (s * 0.2, 0.74, 1.14), (s * 0.3, 0.94, 1.3), 0.05, 0.035, 6), spike(bm, (s * 0.3, 0.94, 1.3), (s * 0.2, 1, -0.1), 0.035, 0.2)) for s in (-1, 1)])
    bones = [B('body', None, (0, 1.0, 0)), B('head', 'body', (0, 0.95, 0.7)), B('jaw', 'head', (0, 0.78, 0.8))]
    for k, s in SIDES:
        S, E, F = V((s * 1.0, 1.25, 0.2)), V((s * 1.05, 0.72, 0.25)), V((s * 1.08, 0.3, 0.33))
        single('Upper' + k, 'stone', 'arm' + k, lambda bm: (tube(bm, S, E, 0.24, 0.21, 7), blob(bm, E, 0.22, 0.22, 0.22, 7, 4)))
        def fore(bm):
            tube(bm, E, F, 0.21, 0.19, 7)
            blob(bm, F + V((0, -0.08, 0.03)), 0.27, 0.22, 0.29, 7, 4)               # the fist
            for x in (-0.12, 0, 0.12):
                spike(bm, F + V((x, -0.08, 0.27)), (0, -0.2, 1), 0.06, 0.14)    # knuckle studs
        single('Fore' + k, 'stone', 'fore' + k, fore)
        def shackle(bm):   # a broken shackle on the wrist, its chain dangling
            hoop(bm, E.lerp(F, 0.75), 0.23, 0.045, 10, 4, up=tuple((F - E).normalized()))
            top = E.lerp(F, 0.75) + V((s * 0.2, -0.02, 0.0))
            for i in range(4):
                hoop(bm, top + V((s * 0.02, -0.1 - i * 0.1, 0)), 0.05, 0.016, 6, 3, up=(0, 0, 1) if i % 2 else (1, 0, 0))
        single('Shackle' + k, 'iron', 'fore' + k, shackle)
        single('Leg' + k, 'stoneDark', 'leg' + k, lambda bm: (tube(bm, (s * 0.55, 0.62, -0.42), (s * 0.6, 0.06, -0.38), 0.22, 0.18, 7), blob(bm, (s * 0.6, 0.05, -0.28), 0.2, 0.08, 0.26, 6, 3)))
        bones += [B('arm' + k, 'body', S), B('fore' + k, 'arm' + k, E), B('leg' + k, 'body', (s * 0.55, 0.62, -0.42))]
    finish('mossback', bones)

# ---------------------------------------------------------------------------
# Spore puffer: a sickly walking mushroom. A lumpy pale stem split by a round lamprey mouth
# ringed with teeth (it pulses), mismatched glowing eyes, a drooping veined cap with a ragged
# rim, glowing spore sacs and dangling tendrils, spindly grasping arms and root legs.
# ---------------------------------------------------------------------------
def puffer():
    palette([('cap', '5e3a62', 0.7), ('vein', '2c1a30', 0.8), ('sac', 'b8ff5a', 0.4, 0, 0.7), ('gill', '2a2024'), ('stem', 'aaa48a', 0.85),
             ('eyeLime', 'd8ff6a', 0.5, 0, 1.0), ('void', '050304'), ('tooth', 'e8e0cc', 0.6), ('root', '3e2a1c')])
    rnd = random.Random(11)
    lumpy = lambda y, r: [(x * (0.9 + rnd.random() * 0.2), yy, z * (0.9 + rnd.random() * 0.2)) for x, yy, z in round_ring(0, y, 0, r, 10)]
    # a tall stem, so its face shows below the cap from the player's view
    single('Stem', 'stem', 'body', lambda bm: loft(bm, [lumpy(0.3, 0.28), lumpy(0.5, 0.27), lumpy(0.72, 0.24), lumpy(0.92, 0.21), lumpy(1.04, 0.19)]))
    MO = V((0, 0.6, 0.255))
    def mouth(bm):   # a round lamprey mouth, teeth all pointing in
        for i in range(12):
            a = i / 12 * math.pi * 2
            edge = MO + V((math.cos(a) * 0.1, math.sin(a) * 0.13, 0.014))
            spike(bm, edge, (-math.cos(a), -math.sin(a), 0.4), 0.014, 0.06, 3)
    single('Mouth', 'void', 'mouth', lambda bm: blob(bm, MO, 0.11, 0.145, 0.045, 8, 5))
    single('MouthTeeth', 'tooth', 'mouth', mouth)
    EYE_SPOTS = [((0.12, 0.86), 0.034), ((-0.1, 0.9), 0.026), ((0.17, 0.48), 0.02), ((-0.15, 0.76), 0.03)]   # scattered and mismatched
    single('Eyes', 'eyeLime', 'body', lambda bm: [blob(bm, (x, y, math.sqrt(max(0, 0.23 ** 2 - x * x)) + 0.015), r, r * 1.2, r * 0.6, 6, 4) for (x, y), r in EYE_SPOTS])
    CY = 1.12
    def cap(bm):   # a drooping dome with a ragged rim (every other point hangs lower)
        rim = [(x, y - (0.07 if i % 2 else 0), z) for i, (x, y, z) in enumerate(round_ring(0, CY - 0.18, 0, 0.52, 14))]
        loft(bm, [rim] + [round_ring(0, CY + y, 0, r, 14) for y, r in ((-0.03, 0.52), (0.13, 0.45), (0.25, 0.31), (0.32, 0.11))], False, True)
    single('Cap', 'cap', 'cap', cap)
    single('Gills', 'gill', 'cap', lambda bm: loft(bm, [round_ring(0, CY - 0.17, 0, 0.49, 14), round_ring(0, CY - 0.09, 0, 0.17, 14)], True, True))
    def veins(bm):   # dark veins running down the cap
        for i in range(7):
            a = i / 7 * math.pi * 2 + 0.2
            pts = [(math.cos(a) * r * 1.02, CY + y, math.sin(a) * r * 1.02) for y, r in ((0.31, 0.13), (0.25, 0.31), (0.13, 0.45), (-0.03, 0.52))]
            sweep(bm, pts, 0.014, 3, up=(0, 1, 0))
    single('Veins', 'vein', 'cap', veins)
    def sacs(bm):   # glowing spore sacs bulging from the cap
        for i in range(9):
            a, y = rnd.random() * math.pi * 2, rnd.random() * 0.28
            r = 0.52 - y * 0.9
            d = V((math.cos(a), 0.5 + y, math.sin(a))).normalized()
            blob(bm, (math.cos(a) * r, CY + y, math.sin(a) * r), 0.06 + rnd.random() * 0.04, 0.045, 0.06 + rnd.random() * 0.04, 6, 4, aim(d))
    single('Sacs', 'sac', 'cap', sacs)
    def tendrils(bm):   # thin tendrils dangling from the rim (fewer at the front, so the face shows)
        for i in range(9):
            a = i / 9 * math.pi * 2 + 0.15
            if abs(math.sin(a) - 1) < 0.25:
                continue
            top = V((math.cos(a) * 0.47, CY - 0.18, math.sin(a) * 0.47))
            sweep(bm, [top, top + V((0, -0.15, 0)), top + V((math.cos(a) * 0.03, -0.32 - (i % 3) * 0.06, math.sin(a) * 0.03))], [0.016, 0.01, 0.002], 4)
    single('Tendrils', 'vein', 'cap', tendrils)
    bones = [B('body', None, (0, 0.34, 0)), B('cap', 'body', (0, CY, 0)), B('mouth', 'body', MO)]
    for k, s in SIDES:
        S, E, W = V((s * 0.21, 0.78, 0.02)), V((s * 0.37, 0.6, 0.1)), V((s * 0.43, 0.42, 0.18))
        single('Arm' + k, 'stem', 'arm' + k, lambda bm: (tube(bm, S, E, 0.04, 0.03), tube(bm, E, W, 0.03, 0.022), blob(bm, E, 0.032, 0.032, 0.032, 6, 4),
                                                          [spike(bm, W, (s * a, -1, 0.3), 0.012, 0.09, 3) for a in (-0.4, 0, 0.4)]))
        L = V((s * 0.15, 0.32, 0))
        skin_tree('Leg' + k, 'root', 'leg' + k, {'h': (L, 0.06), 'f': (L + V((0, -0.25, 0.02)), 0.05), 'a': (L + V((-0.1, -0.31, 0.1)), 0.015), 'b': (L + V((0.1, -0.31, 0.1)), 0.015),
                                                  'c': (L + V((0, -0.31, -0.1)), 0.015)}, [('h', 'f'), ('f', 'a'), ('f', 'b'), ('f', 'c')], 'h', False)
        bones += [B('arm' + k, 'body', S), B('leg' + k, 'body', L)]
    finish('puffer', bones)

# ---------------------------------------------------------------------------
# Shade stalker: a starved shadow wolf. Ribs and a ridge of spine showing through its sides, six
# eyes, a long jaw packed with teeth, ragged ears, a tail that frays into smoke, and long legs
# that bend at real joints.
# ---------------------------------------------------------------------------
def stalker():
    palette([('shade', '1a2028', 0.45), ('shadeBone', '6a7280', 0.5), ('fang', 'e8e4f0', 0.4), ('eyeCyan', '6af0ff', 0.4, 0, 1.0), ('void', '050304')])
    Y = 0.62
    single('Body', 'shade', 'body', lambda bm: loft(bm, [face_ring(z, Y + dy, w, t, b) for z, dy, w, t, b in   # a deep chest and a starved, tucked waist
                                                          [(-0.55, 0.02, 0.09, 0.09, 0.09), (-0.4, 0.04, 0.15, 0.15, 0.14), (-0.12, 0.02, 0.11, 0.1, 0.08), (0.15, 0.03, 0.19, 0.16, 0.2), (0.38, 0.06, 0.19, 0.18, 0.22), (0.5, 0.1, 0.11, 0.12, 0.14)]]))
    def bones_showing(bm):   # spine knuckles down its back, ribs showing on its flanks
        for k in range(11):
            z = 0.45 - k * 0.1
            spike(bm, (0, Y + 0.12 + math.sin(k / 10 * math.pi) * 0.05, z), (0, 1, -0.4), 0.03, 0.08 + math.sin(k / 10 * math.pi) * 0.05, 4)
        for z in (0.08, 0.17, 0.26, 0.35):
            for s in (-1, 1):
                sweep(bm, [(s * 0.05, Y + 0.17, z), (s * 0.19, Y + 0.06, z + 0.02), (s * 0.17, Y - 0.1, z + 0.04)], 0.014, 3, up=(0, 0, 1))
    single('BonesShowing', 'shadeBone', 'body', bones_showing)
    single('Neck', 'shade', 'neck', lambda bm: tube(bm, (0, Y + 0.12, 0.42), (0, Y + 0.19, 0.6), 0.11, 0.09, 8))
    def head(bm):   # a long, narrow skull and snout
        loft(bm, [face_ring(z, Y + 0.2 + dy, w, t, b) for z, dy, w, t, b in [(0.5, 0.02, 0.07, 0.07, 0.07), (0.6, 0.03, 0.12, 0.11, 0.09), (0.72, 0.0, 0.1, 0.08, 0.06), (0.86, -0.03, 0.065, 0.055, 0.045), (0.98, -0.05, 0.04, 0.035, 0.03)]])
        for s in (-1, 1):   # ragged ears (notched)
            prism(bm, [(0, 0), (0.05, 0.02), (0.03, 0.1), (0.045, 0.13), (0.01, 0.24), (-0.02, 0.12)], 0.012, (s * 0.07, Y + 0.28, 0.57), (-0.4, 0, -s * 0.35))
    single('Head', 'shade', 'head', head)
    def eyes(bm):   # six eyes: two big, four small, in rows
        for s in (-1, 1):
            blob(bm, (s * 0.065, Y + 0.25, 0.73), 0.03, 0.015, 0.02, 6, 3, (0, 0, s * 0.3))
            blob(bm, (s * 0.09, Y + 0.28, 0.69), 0.018, 0.012, 0.014, 5, 3)
            blob(bm, (s * 0.075, Y + 0.22, 0.79), 0.014, 0.01, 0.012, 5, 3)
    single('Eyes', 'eyeCyan', 'head', eyes)
    single('Fangs', 'fang', 'head', lambda bm: [spike(bm, (x, Y + 0.13, 0.95 - abs(x) * 1.5), (0, -1, 0.1), 0.01, 0.06, 3) for x in (-0.04, -0.025, -0.01, 0.01, 0.025, 0.04)])
    def jaw(bm):   # a long lower jaw lined with teeth
        loft(bm, [face_ring(z, Y + 0.11, w, 0.025, 0.03) for z, w in ((0.62, 0.08), (0.78, 0.06), (0.96, 0.035))])
        for x in (-0.035, -0.02, 0.0, 0.02, 0.035):
            spike(bm, (x, Y + 0.12, 0.92 - abs(x) * 1.5), (0, 1, 0.1), 0.009, 0.05, 3)
    single('Jaw', 'shade', 'jaw', jaw)
    single('Mouth', 'void', 'head', lambda bm: box(bm, (0.07, 0.02, 0.28), (0, Y + 0.14, 0.82)))
    TP = [V((0, Y + 0.06, -0.55)), V((0, Y + 0.2, -0.82)), V((0, Y + 0.3, -1.12))]
    single('Tail1', 'shade', 'tail1', lambda bm: tube(bm, TP[0], TP[1], 0.05, 0.035, 6))
    def smoke(bm):   # the tail frays into wisps of smoke
        for a in (-0.5, 0, 0.5):
            sweep(bm, [TP[1], TP[1].lerp(TP[2], 0.5) + V((a * 0.08, 0.02, 0)), TP[2] + V((a * 0.15, 0.04 - abs(a) * 0.1, -0.05))], [0.035, 0.02, 0.003], 4)
    single('Tail2', 'shade', 'tail2', smoke)
    bones = [B('body', None, (0, Y, 0)), B('neck', 'body', (0, Y + 0.12, 0.42)), B('head', 'neck', (0, Y + 0.19, 0.6)), B('jaw', 'head', (0, Y + 0.13, 0.62)),
             B('tail1', 'body', TP[0]), B('tail2', 'tail1', TP[1])]
    for name, x, z, hind in (('FL', 0.15, 0.35, False), ('FR', -0.15, 0.35, False), ('BL', 0.13, -0.4, True), ('BR', -0.13, -0.4, True)):
        H = V((x, 0.55, z))
        K = H + (V((0, -0.22, 0.12)) if hind else V((0, -0.25, 0.03)))
        A = V((x, 0.04, z + (0.0 if hind else 0.02)))
        single('Leg' + name, 'shade', 'leg' + name, lambda bm: (tube(bm, H, K, 0.065 if hind else 0.05, 0.035, 6), blob(bm, K, 0.038, 0.038, 0.038, 6, 4)))
        single('Low' + name, 'shade', 'knee' + name, lambda bm: (tube(bm, K, A, 0.032, 0.022, 6), [spike(bm, A + V((dx, 0.0, 0.03)), (dx * 3, -0.3, 1), 0.01, 0.07, 3) for dx in (-0.02, 0, 0.02)]))
        bones += [B('leg' + name, 'body', H), B('knee' + name, 'leg' + name, K)]
    finish('stalker', bones)

# ---------------------------------------------------------------------------
# Sap shaman: a cultist priest of the Hollow King. A ragged crimson robe embroidered with gold
# sigils, a deep hood over an antlered deer-skull mask with ember eyes, a necklace of bone charms
# and a gold sigil medallion, bony hands, and a gnarled staff crowned with an antlered skull that
# holds the glowing sap crystal in its jaws, charms swinging beneath.
# ---------------------------------------------------------------------------
def shaman():
    palette([('robe', '4a1418'), ('robeDark', '240a0c'), ('trim', 'b08a3a', 0.5, 0.3), ('bone', 'd8cbb0', 0.65), ('void', '050304'),
             ('eyeEmber', 'ff6a2a', 0.5, 0, 1.0), ('sap', 'ffb43a', 0.2, 0, 0.7), ('wood', '2e2016'), ('antler', 'c8b896', 0.8)])
    def ragged(y, r, n=12):   # a ragged hem: every other point hangs lower
        return [(math.sin(i * 2 * math.pi / n) * r, y - (0.08 if i % 2 else 0), math.cos(i * 2 * math.pi / n) * r) for i in range(n)]
    single('Hem', 'robeDark', 'hem', lambda bm: loft(bm, [ragged(0.06, 0.46), round_ring(0, 0.45, 0, 0.36, 12)], True, True))
    single('Robe', 'robe', 'body', lambda bm: loft(bm, [round_ring(0, 0.44, 0, 0.37, 12), round_ring(0, 0.8, 0.01, 0.29, 12), round_ring(0, 0.9, 0.02, 0.26, 12)]))
    single('Chest', 'robe', 'torso', lambda bm: loft(bm, [round_ring(0, 0.88, 0.02, 0.27, 12), round_ring(0, 1.06, 0.06, 0.25, 12), round_ring(0, 1.2, 0.08, 0.19, 12), round_ring(0, 1.26, 0.08, 0.1, 12)]))
    def sigils(bm):   # gold sigils embroidered down the robe's front: rings with antler marks
        for y, r in ((0.62, 0.07), (0.38, 0.06)):
            z = math.sqrt(max(0, (0.37 - (y - 0.44) * 0.25) ** 2)) - 0.02
            c = V((0, y, 0.33 if y > 0.5 else 0.38))
            hoop(bm, c, r, 0.008, 10, 3, up=(0, 0, 1))
            for s in (-1, 1):
                sweep(bm, [c + V((s * 0.01, 0, 0.004)), c + V((s * r * 0.6, r * 0.6, 0.004)), c + V((s * r, r * 1.3, 0))], 0.006, 3, up=(0, 0, 1))
        hoop(bm, (0, 0.46, 0.0), 0.37, 0.012, 12, 3)   # a gold band near the hem
    single('Sigils', 'trim', 'body', sigils)
    def hood(bm):
        egg(bm, (0, 1.38, 0.04), 0.26, 0.26, 0.29, 10, 6)
        spike(bm, (0, 1.55, -0.12), (0, 0.6, -1), 0.13, 0.38, 6)
    single('Hood', 'robeDark', 'head', hood)
    single('Face', 'void', 'head', lambda bm: blob(bm, (0, 1.36, 0.27), 0.18, 0.2, 0.08, 8, 5))
    def mask(bm):   # a deer-skull mask: cranium, long snout
        egg(bm, (0, 1.4, 0.3), 0.11, 0.12, 0.08, 8, 5)
        tube(bm, (0, 1.36, 0.34), (0, 1.25, 0.42), 0.07, 0.04, 6)
    single('Mask', 'bone', 'head', mask)
    single('MaskEyes', 'void', 'head', lambda bm: [blob(bm, (s * 0.05, 1.41, 0.37), 0.03, 0.025, 0.02, 5, 3) for s in (-1, 1)])
    single('Eyes', 'eyeEmber', 'head', lambda bm: [blob(bm, (s * 0.05, 1.41, 0.385), 0.013, 0.011, 0.01, 4, 3) for s in (-1, 1)])
    for k, s in SIDES:   # antlers rising from the mask, out through the hood
        skin_tree('Antler' + k, 'antler', 'head', {'a': ((s * 0.07, 1.48, 0.28), 0.022), 'b': ((s * 0.17, 1.62, 0.22), 0.016), 'c': ((s * 0.22, 1.78, 0.16), 0.008),
                                                    't1': ((s * 0.26, 1.66, 0.3), 0.006), 't2': ((s * 0.13, 1.76, 0.12), 0.006)}, [('a', 'b'), ('b', 'c'), ('b', 't1'), ('b', 't2')], 'a', False)
    def charms(bm):   # a necklace of small bones, and a gold medallion
        for k in range(9):
            t = (k / 8 - 0.5) * 2.4
            p = V((math.sin(t) * 0.18, 1.13 - math.cos(t) * 0.1, 0.24 + math.cos(t) * 0.05))
            tube(bm, p, p + V((0, -0.06, 0.01)), 0.012, 0.009, 4)
    single('Charms', 'bone', 'torso', charms)
    single('Medallion', 'trim', 'torso', lambda bm: hoop(bm, (0, 0.98, 0.29), 0.05, 0.014, 10, 3, up=(0, 0.2, 1)))
    single('SleeveR', 'robe', 'armR', lambda bm: tube(bm, (-0.18, 1.15, 0.05), (-0.36, 0.98, 0.16), 0.09, 0.13, 8))
    single('SleeveL', 'robe', 'armL', lambda bm: tube(bm, (0.18, 1.15, 0.05), (0.3, 0.85, 0.2), 0.09, 0.13, 8))
    for k, p, tip in (('R', (-0.38, 0.96, 0.17), (-0.43, 0.92, 0.22)), ('L', (0.31, 0.82, 0.21), (0.33, 0.72, 0.28))):   # bony hands, each on its own arm
        def hand(bm):
            blob(bm, p, 0.04, 0.045, 0.035, 5, 4)
            for dx in (-0.02, 0, 0.02):
                spike(bm, V(p) + V((dx, -0.02, 0.02)), V(tip) - V(p) + V((dx, 0, 0)), 0.008, 0.08, 3)
        single('Hand' + k, 'bone', 'arm' + k, hand)
    SX = V((-0.38, 0.9, 0.15))
    skin_tree('Staff', 'wood', 'staff', {'b': (SX + V((0, -0.85, 0)), 0.03), 'k': (SX + V((0.02, 0.1, 0)), 0.04), 't': (SX + V((-0.01, 0.62, 0)), 0.035)},
              [('b', 'k'), ('k', 't')], 'b', False)
    TOP = SX + V((0, 0.72, 0.03))
    def staff_skull(bm):   # an antlered skull crowning the staff, the crystal held in its jaws
        egg(bm, TOP, 0.08, 0.08, 0.07, 7, 4)
        tube(bm, TOP + V((0, -0.02, 0.05)), TOP + V((0, -0.06, 0.16)), 0.05, 0.03, 6)
    single('StaffSkull', 'bone', 'staff', staff_skull)
    for s in (-1, 1):
        skin_tree('StaffAntler%d' % s, 'antler', 'staff', {'a': (TOP + V((s * 0.05, 0.05, 0)), 0.016), 'b': (TOP + V((s * 0.13, 0.18, -0.03)), 0.01), 'c': (TOP + V((s * 0.12, 0.3, -0.06)), 0.005),
                                                            't': (TOP + V((s * 0.2, 0.22, 0.03)), 0.004)}, [('a', 'b'), ('b', 'c'), ('b', 't')], 'a', False)
    single('Crystal', 'sap', 'staff', lambda bm: blob(bm, TOP + V((0, -0.08, 0.13)), 0.06, 0.09, 0.06, 4, 2))
    def staff_charms(bm):   # bones on cords swinging under the skull
        for dx in (-0.06, 0.0, 0.06):
            p = TOP + V((dx, -0.1, -0.02))
            tube(bm, p, p + V((0, -0.14 - abs(dx), 0)), 0.004, 0.004, 3)
            tube(bm, p + V((0, -0.14 - abs(dx), 0)), p + V((0, -0.2 - abs(dx), 0.01)), 0.012, 0.01, 4)
    single('StaffCharms', 'bone', 'staff', staff_charms)
    bones = [B('body', None, (0, 0.0, 0)), B('hem', 'body', (0, 0.45, 0)), B('torso', 'body', (0, 0.86, 0)), B('head', 'torso', (0, 1.24, 0.08)),
             B('armR', 'torso', (-0.18, 1.15, 0.05)), B('staff', 'armR', SX), B('armL', 'torso', (0.18, 1.15, 0.05))]
    finish('shaman', bones)

# ---------------------------------------------------------------------------
# The Thorn Queen: a bell gown layered with rose petals and wrapped in thorny vines, a
# laced bodice, a great fan of thorn branches, an elegant face, a crown of thorns, long
# arms with thorn whips, and petals drifting around her
# ---------------------------------------------------------------------------
def thornqueen():
    palette([('vine', '3b2436', 0.8), ('vineDark', '2a1726', 0.85), ('rose', 'c0283c', 0.7, 0, 0.15), ('petal', '5e1530', 0.8), ('skin', '5a3a52', 0.75),
             ('eyeAmber', 'ffb43a', 0.5, 0, 1.0), ('void', '050306'), ('gem', 'ff4a8a', 0.3, 0, 0.9)])
    GOWN = [(2.1, 0.02), (1.95, 0.25), (1.55, 0.9), (1.1, 1.7), (0.75, 2.5), (0.56, 3.1), (0.5, 3.45)]
    def prof(pts, y):
        for (r0, y0), (r1, y1) in zip(pts, pts[1:]):
            if y <= y1:
                return r0 + (r1 - r0) * max(0, (y - y0) / (y1 - y0))
        return pts[-1][0]
    single('Gown', 'vine', 'gown', lambda bm: loft(bm, [round_ring(0, y, 0, r, 16) for r, y in GOWN], True, False))
    spiral = lambda h, t: (lambda y, a: (math.cos(a) * (prof(GOWN, y) + 0.04), y, math.sin(a) * (prof(GOWN, y) + 0.04), a))(0.2 + t * 3.1, h * 2.094 + t * math.pi * 2.2)
    def vines(bm):
        for h in range(3):
            sweep(bm, [spiral(h, i / 16)[:3] for i in range(17)], 0.05, 5, up=(0, 1, 0))
            for i in range(1, 12):
                x, y, z, a = spiral(h, i / 12)
                spike(bm, (x, y, z), (math.cos(a), 0.4, math.sin(a)), 0.045, 0.24 + (i % 3) * 0.08, 5)
    single('GownVines', 'vineDark', 'gown', vines)
    single('GownRoses', 'rose', 'gown', lambda bm: [rose(bm, spiral(h, t)[:3], (math.cos(spiral(h, t)[3]), 0.4, math.sin(spiral(h, t)[3])), 1.5 - t * 0.6) for h in range(3) for t in (0.12, 0.42, 0.72)])
    def petals(bm):
        for n, y, size, droop, off in ((20, 0.22, 0.42, 0.35, 0), (15, 0.95, 0.33, 0.5, 0.2), (10, 1.85, 0.26, 0.6, 0.1)):
            for k in range(n):
                a = (k + off) / n * math.pi * 2
                r = prof(GOWN, y) + 0.04
                blob(bm, (math.cos(a) * r, y, math.sin(a) * r), size * 0.85, size * 0.16, size * 1.4, 6, 3, aim((math.cos(a), -droop, math.sin(a))) @ rot_xyz(math.pi / 2, 0, 0))
    single('GownPetals', 'petal', 'gown', petals)
    BOD = [(0.52, 3.35), (0.46, 3.6), (0.42, 3.85), (0.5, 4.15), (0.66, 4.45), (0.72, 4.62), (0.6, 4.8), (0.32, 4.93), (0.15, 5.0)]
    single('Bodice', 'vine', 'chest', lambda bm: (loft(bm, [round_ring(0, y, 0, r, 12) for r, y in BOD]), tube(bm, (0, 4.85, 0), (0, 5.12, 0.02), 0.15, 0.12, 8)))
    def bodice_vines(bm):
        hoop(bm, (0, 3.62, 0), 0.46, 0.045, 12, 5)
        hoop(bm, (0, 4.53, 0), 0.71, 0.045, 14, 5)
        for d in (-1, 1):
            for base in (-0.8, 0, 0.8):
                pts = []
                for i in range(7):
                    t = i / 6
                    y = 3.45 + t * 0.95
                    a = math.pi / 2 + base + d * (t - 0.5) * 1.6
                    r = prof(BOD, y) + 0.02
                    pts.append((math.cos(a) * r, y, math.sin(a) * r))
                sweep(bm, pts, 0.03, 4, up=(0, 1, 0))
        for s in (-1, 1):
            for k in range(6):
                spike(bm, (s * 0.62, 4.66, (k - 2.5) * 0.1), (s, 0.3 + (k % 3) * 0.35, (k - 2.5) * 0.3), 0.07, 0.42 + (k % 3) * 0.14, 5)
    single('BodiceVines', 'vineDark', 'chest', bodice_vines)
    single('BodiceRoses', 'rose', 'chest', lambda bm: (rose(bm, (0, 4.42, 0.66), (0, 0.2, 1), 1.9),
                                                       [rose(bm, p, o, sz) for s in (-1, 1) for p, o, sz in (((s * 0.66, 4.64, 0.16), (s, 1, 0.3), 1.3), ((s * 0.76, 4.52, -0.12), (s, 0.8, -0.2), 1.2), ((s * 0.3, 3.62, 0.36), (s * 0.6, 0, 1), 1.0))]))
    # the face: long and elegant, cheekbones, a pointed chin
    HC = V((0, 5.2, 0.05))
    head = single('Face', 'skin', 'head', lambda bm: loft(bm, [face_ring(HC.z + z, HC.y + dy, w, t, b) for z, dy, w, t, b in
                                                              [(-0.26, 0.02, 0.14, 0.2, 0.22), (-0.14, 0.02, 0.24, 0.36, 0.36), (0.0, 0.0, 0.27, 0.4, 0.42), (0.14, -0.02, 0.23, 0.36, 0.44), (0.25, -0.04, 0.14, 0.28, 0.4), (0.3, -0.06, 0.05, 0.14, 0.26)]]))
    T = bvh(head)
    def eyes(bm):
        for s in (-1, 1):
            p, n = surf(T, (s * 0.12, HC.y + 0.06, 2), (0, 0, -1))
            blob(bm, p + n * 0.003, 0.085, 0.032, 0.025, 6, 4, aim((0, 0, 1)) @ rot_xyz(0, s * 0.3, 0))
    single('Eyes', 'eyeAmber', 'head', eyes)
    single('Mouth', 'void', 'mouth', lambda bm: blob(bm, surf(T, (0, HC.y - 0.18, 2), (0, 0, -1))[0], 0.09, 0.025, 0.03, 6, 3))
    def crown(bm):
        hoop(bm, HC + V((0, 0.36, -0.02)), 0.24, 0.035, 12, 5)
        for k in range(11):
            a = k / 11 * math.pi * 2 + math.pi / 2
            front = max(0, math.sin(a))
            spike(bm, HC + V((math.cos(a) * 0.24, 0.37, math.sin(a) * 0.24 - 0.02)), (math.cos(a) * 0.25, 1, math.sin(a) * 0.25), 0.04, 0.4 + (k % 2) * 0.3 + front * 0.25, 5)
        for i in range(7):   # vine hair falling down her back
            x, w = (i - 3) * 0.06, math.sin(i * 1.7) * 0.08
            sweep(bm, [HC + V(p) for p in ((x, 0.25, -0.18), (x * 1.6, -0.15, -0.38), (x * 2.2 + w, -0.7, -0.52), (x * 2.6 - w, -1.3, -0.58), (x * 2.8, -1.8, -0.5))], 0.035, 4, up=(0, 0, 1))
    single('Crown', 'vineDark', 'head', crown)
    single('CrownRoses', 'rose', 'head', lambda bm: (rose(bm, HC + V((0, 0.48, 0.26)), (0, 0.3, 1), 1.4), [rose(bm, HC + V((math.cos(math.pi / 2 + d) * 0.25, 0.38, math.sin(math.pi / 2 + d) * 0.25)), (math.cos(math.pi / 2 + d), 0.5, math.sin(math.pi / 2 + d)), 0.8) for d in (-0.9, 0.9)]))
    # the collar: a great fan of thorn branches behind her head, each with side thorns
    CB = V((0, 4.8, -0.3))
    nodes, edges = {'root': (CB, 0.08)}, []
    tips = []
    for k in range(13):
        a = -1.35 + k * 0.225
        base = CB + V((math.sin(a) * 0.4, math.cos(a) * 0.15, 0))
        d = V((math.sin(a), math.cos(a), -0.15)).normalized()
        ln = 1.4 + 0.8 * math.cos(a)
        nodes['b%d' % k] = (base, 0.07)
        nodes['m%d' % k] = (base + d * ln * 0.5, 0.045)
        nodes['t%d' % k] = (base + d * ln, 0.012)
        side = V((-d.y, d.x, 0)) * (1 if k % 2 else -1)
        nodes['s%d' % k] = (base + d * ln * 0.5 + (side + d * 0.6).normalized() * 0.26, 0.01)
        edges += [('root', 'b%d' % k), ('b%d' % k, 'm%d' % k), ('m%d' % k, 't%d' % k), ('m%d' % k, 's%d' % k)]
        tips.append((base + d * ln * 0.72, d))
    skin_tree('Collar', 'vineDark', 'collar', nodes, edges, 'root', False)
    single('CollarRoses', 'rose', 'collar', lambda bm: [rose(bm, p, (d.x * 0.3, d.y * 0.3, 1), 1.0) for i, (p, d) in enumerate(tips) if i % 2 == 0])
    single('Petals', 'rose', 'petals', lambda bm: [blob(bm, (math.cos(a) * r, y, math.sin(a) * r), 0.09, 0.03, 0.13, 5, 3, (k * 0.7, k * 1.3, k * 0.4)) for k, (a, r, y) in
                                                    enumerate((k / 16 * math.pi * 2 + (k * 0.37) % 1, 2.4 + (k * 0.53) % 0.9, 1 + (k * 1.7) % 4) for k in range(16))])
    bones = [B('body', None, (0, 0, 0)), B('gown', 'body', (0, 1.7, 0)), B('chest', 'body', (0, 3.6, 0)), B('head', 'chest', (0, 5.0, 0.05)), B('mouth', 'head', HC + V((0, -0.18, 0.3))),
             B('collar', 'chest', CB), B('petals', 'body', (0, 0, 0))]
    for k, s in SIDES:
        S = V((s * 0.7, 4.55, 0.05))
        u = V((s * math.sin(0.35), -math.cos(0.35), 0))
        E = S + u * 1.5
        W = E + (u + V((0, 0, 0.22))).normalized() * 1.45
        single('Upper' + k, 'vine', 'arm' + k, lambda bm: (tube(bm, S, E, 0.1, 0.075, 8), blob(bm, E, 0.085, 0.085, 0.085, 6, 4)))
        single('Fore' + k, 'vine', 'fore' + k, lambda bm: (tube(bm, E, W, 0.075, 0.045, 8), blob(bm, W + V((0, -0.06, 0)), 0.07, 0.09, 0.05, 6, 4)))
        def whips(bm):
            for i, t in enumerate((0.2, 0.4, 0.6, 0.8)):
                p = E + (W - E) * t
                spike(bm, p, (s, -0.4, 0.4 if i % 2 else -0.3), 0.045, 0.3, 5)
            hoop(bm, E + (W - E) * 0.92, 0.06, 0.02, 8, 4, up=tuple((W - E).normalized()))
            for x in (-0.045, -0.015, 0.015, 0.045):   # long clawed fingers
                spike(bm, W + V((x, -0.1, 0)), (x * 3 + u.x * 0.5, -1, 0.25), 0.02, 0.36 - abs(x) * 1.5)
        single('Whips' + k, 'vineDark', 'fore' + k, whips)
        bones += [B('arm' + k, 'chest', S), B('fore' + k, 'arm' + k, E)]
    finish('thornqueen', bones)

# ---------------------------------------------------------------------------
# The Hollow King: an amalgamation of bones around a beating core, crowned. Ribs from many
# rib cages overlap at odd angles round a spine; long bones cross the mass like a cage; the
# skulls of lesser beasts are fused into his chest and hips, embers in their eyes; two great
# skulls sit on his shoulders as pauldrons, rimmed in gold. In the middle, the burning heart,
# with shards of bone orbiting it. His face is a stag's skull (a hinged jaw, empty sockets with
# embers, fire glowing through its cracks) under a gold crown and great dead-wood antlers; gold
# chains hang across his chest; a fur mantle and a ragged, red-lined royal cape; arms of bundled
# long bones ending in bone claws; tails of vertebrae dangling beneath him as he floats.
# ---------------------------------------------------------------------------
def long_bone(bm, a, b, r):
    """A long bone (femur-like): a shaft with a double knob at each end."""
    a, b = V(a), V(b)
    d = (b - a).normalized()
    side = d.orthogonal().normalized() * r * 0.75
    tube(bm, a, b, r, r * 0.85, 6)
    for end in (a, b):
        for o in (side, -side):
            blob(bm, end + o, r * 1.25, r * 1.25, r * 1.25, 5, 4)

def beast_skull(at, face, s):
    """Where a small animal skull goes: returns (shapes in bone, its two eye sockets). `face` is
    the way it looks; s its size."""
    q = aim(face) @ rot_xyz(-math.pi / 2, 0, 0)   # local +Z → face, local +Y → up-ish
    at = V(at)
    to = lambda x, y, z: at + (q @ V((x * s, y * s, z * s, 0))).to_3d()
    def shapes(bm):
        blob(bm, to(0, 0, 0), 0.17 * s, 0.15 * s, 0.17 * s, 6, 4, q)                       # cranium
        tube(bm, to(0, -0.02, 0.08), to(0, -0.06, 0.3), 0.1 * s, 0.05 * s, 6)                  # snout
        for x in (-0.05, 0.05):
            spike(bm, to(x, -0.09, 0.26), (q @ V((0, -1, 0.2, 0))).to_3d(), 0.012 * s, 0.07 * s, 3)   # fangs
    return shapes, [to(x, 0.04, 0.12) for x in (-0.075, 0.075)]

def hollowking():
    palette([('bone', 'd8cbb0', 0.75), ('boneOld', 'b0a284', 0.85), ('boneDark', '8a7c62', 0.9), ('rib', '5a4636', 0.9), ('void', '050306'),
             ('ember', 'ff6a2a', 0.5, 0, 1.0), ('hot', 'ffc070', 0.5, 0, 1.0), ('gold', 'c09a40', 0.45, 0.5), ('cloak', '2a2228', 0.85),
             ('lining', '5a1420', 0.8), ('fur', '1c1618', 1.0)])
    O = 0.6   # he floats: everything sits 0.6 m up
    rnd = random.Random(1111)
    HC = V((0, O + 3.2, -0.1))   # the heart
    spine_z = lambda i: -0.85 - math.sin(i / 10 * math.pi) * 0.14
    def mass(bm):   # the bone mass: spine, ribs from many cages, pelvis, collarbones, neck
        for i in range(11):
            y, z = O + 1.6 + i * 0.32, spine_z(i)
            cyl(bm, 0.13, 0.14, 0.2, 7, place((0, y, z)))
            spike(bm, (0, y, z - 0.1), (0, -0.3, -1), 0.06, 0.22, 4)
        for k in range(9):   # ribs, each pair tilted and sized a little differently: not one creature's
            y, w, z0 = O + 1.9 + k * 0.33, 0.85 + math.sin((k + 1) / 10 * math.pi) * 0.45 + rnd.random() * 0.15, spine_z(1 + k)
            tilt = (rnd.random() - 0.5) * 0.4
            for s in (-1, 1):
                pts = [(s * 0.12, y, z0 + 0.05), (s * w * 0.8, y - 0.08 + s * tilt * 0.3, -0.55), (s * w, y - 0.3 + s * tilt, 0.0), (s * w * 0.86, y - 0.55 + s * tilt, 0.4)]
                if rnd.random() < 0.6:
                    pts.append((s * w * 0.6, y - 0.75 + s * tilt, 0.58))
                sweep(bm, pts, 0.06 + rnd.random() * 0.03, 6, up=(0, 1, 0))
        hoop(bm, (0, O + 1.55, -0.15), 0.9, 0.14, 12, 5)            # pelvis
        for s in (-1, 1):
            blob(bm, (s * 0.75, O + 1.75, -0.35), 0.36, 0.28, 0.1, 6, 4, (0, s * 0.6, 0))
            sweep(bm, [(0, O + 4.85, -0.8), (s * 0.6, O + 4.95, -0.4), (s * 1.25, O + 4.75, -0.15)], 0.1, 6, up=(0, 0, 1))   # collarbones
        sweep(bm, [(0, O + 4.85, -0.75), (0, O + 5.15, -0.4), (0, O + 5.3, -0.05)], [0.13, 0.11, 0.1], 7, up=(1, 0, 0))   # neck
    single('Mass', 'bone', 'body', mass)
    def crossing(bm):   # long bones crossing the mass like the bars of a cage, never through the heart
        for i in range(12):
            a = i / 12 * math.pi * 2 + rnd.random() * 0.3
            c = HC + V((math.cos(a) * (0.95 + rnd.random() * 0.25), (rnd.random() - 0.5) * 1.8, math.sin(a) * 0.75 - 0.15))
            d = V((rnd.random() - 0.5, rnd.random() - 0.5, rnd.random() - 0.5)).normalized() * (0.55 + rnd.random() * 0.25)
            long_bone(bm, c - d, c + d, 0.055 + rnd.random() * 0.02)
    single('Crossing', 'boneOld', 'body', crossing)
    # lesser skulls fused into the chest, hips and back, embers in their eyes
    skulls = [beast_skull(p, f, s) for p, f, s in (
        ((0.62, O + 2.4, 0.42), (0.6, -0.2, 1), 1.0), ((-0.55, O + 2.1, 0.45), (-0.5, -0.1, 1), 0.9), ((0.45, O + 4.2, 0.35), (0.4, 0.2, 1), 0.85),
        ((-0.5, O + 4.0, 0.4), (-0.4, 0.1, 1), 0.95), ((0.85, O + 1.6, 0.05), (1, -0.4, 0.3), 1.1), ((-0.9, O + 1.7, 0.0), (-1, -0.3, 0.2), 1.0),
        ((0, O + 1.45, 0.45), (0, -0.5, 1), 1.2))]
    single('Skulls', 'boneDark', 'body', lambda bm: [shp(bm) for shp, _ in skulls])
    single('SkullSockets', 'void', 'body', lambda bm: [blob(bm, p, 0.045, 0.04, 0.03, 5, 3) for _, eyes in skulls for p in eyes])
    single('SkullEmbers', 'ember', 'body', lambda bm: [blob(bm, p, 0.02, 0.02, 0.02, 4, 3) for _, eyes in skulls for p in eyes])
    single('Veins', 'ember', 'body', lambda bm: [sweep(bm, [HC, HC.lerp(V(p), 0.5) + V((math.sin(i) * 0.1, 0.15, 0)), V(p)], 0.022, 4, up=(0, 0, 1))
                                                 for i, p in enumerate(((0.9, O + 3.6, -0.5), (-0.9, O + 3.6, -0.5), (0.85, O + 2.6, -0.45), (-0.85, O + 2.6, -0.45), (0, O + 3.1, -0.85),
                                                                        (0.5, O + 4.3, -0.55), (-0.5, O + 4.3, -0.55)))])
    def heart(bm):   # the beating core: a faceted burning gem
        ring = lambda y, r, t: [(math.sin(i * math.pi / 3 + t) * r, HC.y + y, HC.z + math.cos(i * math.pi / 3 + t) * r) for i in range(6)]
        loft(bm, [ring(0.45, 0.05, 0), ring(0.22, 0.32, math.pi / 6), ring(-0.05, 0.36, 0), ring(-0.4, 0.04, math.pi / 6)])
    single('Heart', 'ember', 'heart', heart)
    single('Core', 'hot', 'heart', lambda bm: blob(bm, HC + V((0, 0.02, 0.18)), 0.14, 0.18, 0.12, 6, 4))
    for i, (r, up, n) in enumerate(((0.58, (0, 1, 0), 6), (0.72, (1, 0.3, 0), 7), (0.86, (0, 0.4, 1), 8))):
        def shards(bm):   # shards of bone orbiting the heart (each ring spins on its own axis)
            u = V(up).normalized(); a0 = u.orthogonal().normalized(); b0 = u.cross(a0)
            for j in range(n):
                t = j / n * math.pi * 2
                p = HC + (a0 * math.cos(t) + b0 * math.sin(t)) * r
                tang = (-a0 * math.sin(t) + b0 * math.cos(t)) * 0.13
                long_bone(bm, p - tang, p + tang, 0.025)
        single('Shards%d' % i, 'bone', 'gyro%d' % i, shards)
    # the stag-skull face, hunched forward, with a hinged lower jaw
    SK = V((0, O + 5.45, 0.25))
    Z = 1.35   # the skull's size (it has to read from across the clearing)
    def skull(bm):
        loft(bm, [face_ring(SK.z + z * Z, SK.y + dy * Z, w * Z, t * Z, b * Z) for z, dy, w, t, b in
                  [(-0.35, 0.1, 0.22, 0.25, 0.22), (-0.15, 0.12, 0.42, 0.42, 0.3), (0.1, 0.06, 0.4, 0.36, 0.26), (0.35, -0.04, 0.26, 0.24, 0.16), (0.6, -0.14, 0.17, 0.15, 0.1), (0.78, -0.2, 0.1, 0.09, 0.07)]])
        for x in (-0.12, -0.06, 0.0, 0.06, 0.12):   # upper teeth
            spike(bm, SK + V((x * Z, (-0.24 + abs(x) * 0.3) * Z, (0.55 - abs(x) * 0.6) * Z)), (0, -1, 0.15), 0.03, 0.11)
    sk = single('Skull', 'bone', 'head', skull)
    T = bvh(sk)
    SOCK = {}
    for k, s in SIDES:
        SOCK[k] = surf(T, (s * 0.2 * Z, SK.y + 0.1 * Z, 3), (0, 0, -1))[0]
    single('Sockets', 'void', 'head', lambda bm: [blob(bm, SOCK[k] + V((0, 0, -0.04)), 0.13 * Z, 0.11 * Z, 0.08 * Z, 7, 4, (0, 0, s * 0.35)) for k, s in SIDES])
    single('EyeEmbers', 'ember', 'head', lambda bm: [blob(bm, SOCK[k] + V((0, -0.01, -0.03)), 0.05, 0.04, 0.03, 6, 4) for k, s in SIDES])
    single('Cracks', 'ember', 'head', lambda bm: [box(bm, (0.03, ln * Z, 0.02), surf(T, (x * Z, SK.y + y * Z, 3), (0, 0, -1))[0] + V((0, 0, 0.004)), (0, 0, rz)) for x, y, ln, rz in
                                                  ((0.12, 0.3, 0.26, 0.5), (0.3, 0.18, 0.14, -0.4), (-0.28, 0.0, 0.22, -0.3), (0.06, -0.1, 0.18, 0.2))])
    def jaw(bm):
        loft(bm, [face_ring(SK.z + z * Z, SK.y - 0.3 * Z, w * Z, 0.05 * Z, 0.07 * Z) for z, w in ((0.0, 0.3), (0.3, 0.22), (0.62, 0.13), (0.76, 0.07))])
        for x in (-0.1, -0.03, 0.04, 0.1):
            spike(bm, SK + V((x * Z, -0.27 * Z, (0.5 - abs(x) * 0.5) * Z)), (0, 1, 0.1), 0.026, 0.09)
    single('Jaw', 'bone', 'jaw', jaw)
    CY, CZ, CR = SK.y + 0.42 * Z, SK.z - 0.12 * Z, 0.47 * Z   # the crown sits on top of the skull
    def crown(bm):
        loft(bm, [round_ring(0, CY, CZ, CR, 8), round_ring(0, CY + 0.25, CZ, CR * 1.07, 8)], False, False)
        for k in range(8):
            a = k / 8 * math.pi * 2 + math.pi / 8
            base = V((math.sin(a) * CR * 1.07, CY + 0.25, CZ + math.cos(a) * CR * 1.07))
            spike(bm, base, (math.sin(a) * 0.15, 1, math.cos(a) * 0.15), 0.085, 0.45 + (k % 2) * 0.3, 5)
    single('Crown', 'gold', 'head', crown)
    single('Jewels', 'ember', 'head', lambda bm: [blob(bm, (math.sin(a) * CR * 1.04, CY + 0.12, CZ + math.cos(a) * CR * 1.04), 0.06, 0.07, 0.06, 6, 4) for a in (0, 0.9, -0.9)])
    for k, s in SIDES:   # great dead-wood antlers
        A0 = SK + V((s * 0.32 * Z, 0.4 * Z, -0.2 * Z))
        P = lambda x, y, z: A0 + V((s * x, y, z))
        skin_tree('Antler' + k, 'rib', 'head', {'a': (A0, 0.08), 'b': (P(0.3, 0.5, -0.1), 0.065), 'c': (P(0.55, 1.05, -0.2), 0.05), 'd': (P(0.9, 1.5, -0.25), 0.04), 'e': (P(1.3, 1.8, -0.2), 0.025),
                                                'f': (P(0.1, 0.3, 0.45), 0.02), 'g': (P(0.35, 1.0, 0.25), 0.02), 'h': (P(0.55, 1.6, 0.1), 0.02), 'i': (P(0.95, 2.05, -0.1), 0.015), 'j': (P(1.6, 2.0, -0.15), 0.012)},
                  [('a', 'b'), ('b', 'c'), ('c', 'd'), ('d', 'e'), ('a', 'f'), ('b', 'g'), ('c', 'h'), ('d', 'i'), ('e', 'j')], 'a')
    # royal trappings: a shaggy fur mantle, gold chains across the bones, great skulls as pauldrons
    def fur(bm):
        hoop(bm, (0, O + 4.82, -0.3), 1.05, 0.3, 14, 6)
        for k in range(18):
            a = k / 18 * math.pi * 2
            spike(bm, (math.cos(a) * 1.3, O + 4.7, math.sin(a) * 0.9 - 0.3), (math.cos(a), -0.7, math.sin(a)), 0.14, 0.36, 4)
    single('Fur', 'fur', 'chest', fur)
    def chains(bm):   # two gold chains slung across the chest, hanging in a curve
        for drop, sag in ((0.9, 0.0), (1.6, 0.15)):
            pts = [(x, O + 4.7 - drop * (1 - (x / 1.15) ** 2) - sag, 0.62 - abs(x) * 0.35) for x in (-1.15, -0.8, -0.4, 0.0, 0.4, 0.8, 1.15)]
            sweep(bm, pts, 0.035, 4, up=(0, 0, 1))
        blob(bm, (0, O + 3.95 - 0.15, 0.62), 0.09, 0.12, 0.04, 6, 4)   # a gold medallion
    single('Chains', 'gold', 'chest', chains)
    big = [beast_skull((s * 1.35, O + 5.0, -0.1), (s, 0.5, 0.4), 2.2) for s in (-1, 1)]
    single('Pauldrons', 'bone', 'chest', lambda bm: [shp(bm) for shp, _ in big])
    single('PauldronEyes', 'ember', 'chest', lambda bm: [blob(bm, p, 0.04, 0.04, 0.04, 5, 3) for _, eyes in big for p in eyes])
    single('PauldronRims', 'gold', 'chest', lambda bm: [hoop(bm, (s * 1.3, O + 4.82, -0.12), 0.36, 0.035, 12, 4, up=(s * 0.4, 1, 0)) for s in (-1, 1)])
    # the cape: a thick crescent shell hanging behind (red inside), its hem ragged
    def cape(bm):
        n = 9
        def ring(y, r, ragged=False):
            outer, inner = [], []
            for i in range(n):
                a = math.pi * 0.6 + i / (n - 1) * math.pi * 0.8
                dy = (-0.25 if i % 2 else 0) if ragged else 0
                outer.append((math.sin(a) * r, y + dy, -0.3 + math.cos(a) * r))
                inner.append((math.sin(a) * (r - 0.06), y + dy, -0.3 + math.cos(a) * (r - 0.06)))
            return outer + inner[::-1]
        faces = loft(bm, [ring(O + 4.8, 1.4), ring(O + 3.0, 1.85), ring(O + 0.55, 2.2, True)])
        for seg in faces[:-1]:
            for i in range(n, 2 * n - 1):
                seg[i].material_index = 1     # the inner surface: the blood-red lining
    single('Cape', ['cloak', 'lining'], 'cape', cape)
    bones = [B('body', None, (0, O, 0)), B('chest', 'body', (0, O + 3.2, -0.3)), B('heart', 'chest', HC), B('gyro0', 'chest', HC), B('gyro1', 'chest', HC), B('gyro2', 'chest', HC),
             B('head', 'chest', SK + V((0, -0.15, -0.3))), B('jaw', 'head', SK + V((0, -0.3, -0.15))), B('cape', 'chest', (0, O + 4.8, -0.3))]
    # arms of bundled long bones (two side by side, like a forearm), ending in long bone claws
    for k, s in SIDES:
        S = V((s * 1.3, O + 4.6, -0.15))
        E = S + V((s * 0.5, -1.85, 0.1))
        W = E + V((s * 0.1, -1.7, 0.75))
        off = lambda a, b: (b - a).normalized().orthogonal().normalized() * 0.07
        single('Upper' + k, 'bone', 'arm' + k, lambda bm: (long_bone(bm, S, E, 0.11), long_bone(bm, S + off(S, E) * 1.2, E + off(S, E) * 1.2, 0.06)))
        single('Fore' + k, 'boneOld', 'fore' + k, lambda bm: (long_bone(bm, E + off(E, W), W + off(E, W), 0.07), long_bone(bm, E - off(E, W), W - off(E, W), 0.06),
                                                               [hoop(bm, E + (W - E) * t, 0.15, 0.03, 8, 4, up=tuple((W - E).normalized())) for t in (0.3, 0.7)]))
        D = (W - E).normalized()
        skin_tree('Claw' + k, 'bone', 'hand' + k, {'w': (W, 0.08), **{'c%d' % i: (W + (D * 0.5 + V((x, -0.2, 0.15))), 0.012) for i, x in enumerate((-0.12, -0.04, 0.04, 0.12))},
                                                   't': (W + V((-s * 0.1, 0.0, 0.35)), 0.012)}, [('w', 'c%d' % i) for i in range(4)] + [('w', 't')], 'w', False)
        bones += [B('arm' + k, 'chest', S), B('fore' + k, 'arm' + k, E), B('hand' + k, 'fore' + k, W)]
    def tails(bm):   # tails of vertebrae dangling beneath him (they sway)
        for i in range(7):
            a = i / 7 * math.pi * 2
            x, z, w = math.cos(a) * 0.7, math.sin(a) * 0.55 - 0.15, math.sin(i * 2.3) * 0.15
            path = [V((x, O + 1.5, z)), V((x * 1.1 + w, O + 0.9, z * 1.1)), V((x * 0.9 - w, O + 0.3, z * 1.2)), V((x * 1.2, O - 0.4, z))]
            for j in range(9):   # little vertebrae along the path, shrinking
                t = j / 8 * 3
                p = path[min(2, int(t))].lerp(path[min(3, int(t) + 1)], t - int(t))
                r = 0.07 - j * 0.006
                cyl(bm, r, r, 0.08, 6, place(p, aim(path[min(3, int(t) + 1)] - path[min(2, int(t))])))
    single('Tails', 'boneOld', 'roots', tails)
    bones.append(B('roots', 'body', (0, O + 1.5, -0.15)))
    finish('hollowking', bones)

# ---------------------------------------------------------------------------
CREATURES = {'imp': imp, 'wisp': wisp, 'stump': stump, 'mossback': mossback, 'puffer': puffer, 'stalker': stalker, 'shaman': shaman,
             'thornqueen': thornqueen, 'hollowking': hollowking}
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
only = [a for a in args if a in CREATURES]
for name, fn in CREATURES.items():
    if only and name not in only:
        continue
    reset_scene()
    fn()
    log('built %s: %d parts' % (name, len(PARTS)))
