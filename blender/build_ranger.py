"""
build_ranger.py — models the Pinewood deer ranger in Blender, from scratch, then
rigs it, saves blender/ranger.blend, and exports js/models/ranger.js for the game.

The look follows the "Deer Ranger Redesign" model sheet: a broad, boxy khaki uniform
with a button placket, pointed flap pockets, a gold shield badge and a green name tag;
shield patches on sleeves rolled to the elbow; a green neckerchief; a duty belt with a
brass buckle, radio and canteen; straight green trousers with cargo pockets; boots that
end in split hooves; hoof hands; a big angular deer head with a long snout, big eyes,
dark cheek patches and long diamond ears; a big campaign hat (wide flat brim, tall
pinched crown, leather band, pine pin) with compact four-tined antlers coming up
through the crown; a big backpack with a round pine emblem and a bedroll; a white tail.

HOW TO RUN (from the PinewoodToss folder; the Microsoft Store Blender is "blender-launcher"):
  blender-launcher --background --factory-startup --python blender\\run.py -- build_ranger
It writes blender/build_ranger_log.txt (ends with DONE or FAILED).

!! This script builds the model from nothing and OVERWRITES ranger.blend. Once you start
!! editing ranger.blend by hand in Blender, don't run this again: just re-export with
!! blender\\export_model.cmd ranger

HOW THE MODEL IS MADE
  - Body, head, neck, arms and legs are LOFTED, the way a low-poly artist box-models:
    a series of hand-placed cross-section rings (8 points each, mirrored left/right),
    joined with clean quads. Every facet is deliberate and the two sides match exactly.
    (An earlier version used metaballs + decimation, which left random, lopsided
    triangles: don't go back to that.)
  - The face is one lofted mesh from the back of the skull to the nose tip; its colors
    (pale lower muzzle, dark cheeks, dark nose) are painted onto chosen faces.
  - Antlers use the SKIN modifier: a branching tree of points with a thickness at each,
    wrapped in a mesh.
  - Gear (hat, boots, pack, belt, badge, pockets...) is beveled boxes, cylinders and flat
    cut-out shapes, placed by casting rays at the body so it sits right on the surface.
  - An ARMATURE with the game's bones (same names and positions as js/deer.js, plus ear,
    eye and tail bones) drives it. Clothes and body are skinned with vertex groups;
    rigid gear is parented to a single bone.
  - Each material's viewport color is the color the game uses.

COORDINATES
  The numbers below are in GAME space (Y up, character faces +Z, its left is +X), the same
  numbers as js/deer.js. G() converts a game point to Blender (Z up, faces -Y).
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pinewood_export
from pwkit import *          # the shared modeling toolkit: G, place, loft, rings, prism, single, surf, rig...

set_log('build_ranger')
reset_scene()

# the model sheet's palette
palette([('fur', '8a5a33'), ('furDark', '6b4426'), ('furLight', 'b98a5c'), ('pale', 'e8d9bd'), ('dark', '24170f', 0.5), ('eye', '1a110b', 0.4),
         ('horn', 'e6d8b8', 0.9), ('earPink', 'd9a98a'), ('hoof', '5c3a20', 0.7),
         ('shirt', 'c8b07a'), ('shirtDark', '9c895f', 0.9), ('button', '6b5a3a', 0.7), ('tag', '1f2a1c', 0.8),
         ('pants', '3f5a32'), ('pantsDark', '30452a', 0.9),
         ('hat', 'b89a62', 0.9), ('hatDark', '846f47', 0.9), ('band', '5a3a22', 0.9), ('leather', '4a3020', 0.9),
         ('scarf', '2f6b3a'), ('scarfDark', '214b29'), ('brass', 'e0b84a', 0.5, 0.0), ('pine', 'a9c97a'),
         ('pack', '5f6b4a', 0.9), ('packDark', '4d5839', 0.9), ('emblem', '3d2819', 0.9), ('bedroll', '8a6a44', 0.9),
         ('gear', '2a2a2a', 0.9), ('boot', '2b1d14', 0.9), ('bootCuff', '4a3324', 0.9), ('white', 'efe4cc')])
SIDES = [('L', 1), ('R', -1)]   # L = the deer's left (+x)

# ---------------------------------------------------------------------------
# Body, lofted: a broad, boxy uniform; straight trousers; rolled sleeves
# (each ring: height, half-width, half-depth, corner cut — numbers you can tweak directly)
# ---------------------------------------------------------------------------
torso = single('Shirt', 'shirt', 'torso', lambda bm: loft(bm, [   # rounded, not boxy: 12-sided rings
    oval_ring(1.0, 0.155, 0.1),                 # tucked in at the belt
    oval_ring(1.1, 0.158, 0.105),
    oval_ring(1.22, 0.165, 0.11, 0.004),
    oval_ring(1.34, 0.177, 0.116, 0.01),        # chest swelling forward a little
    oval_ring(1.45, 0.19, 0.118, 0.012),
    oval_ring(1.53, 0.196, 0.112, 0.006),       # shoulders
    oval_ring(1.585, 0.172, 0.1),               # shoulder slope
    oval_ring(1.62, 0.128, 0.085),
    oval_ring(1.645, 0.078, 0.066, 0.0, 12, 2.0),   # collar
]))

def trousers(bm):
    loft(bm, [oval_ring(0.86, 0.145, 0.098), oval_ring(0.98, 0.16, 0.106), oval_ring(1.07, 0.16, 0.104)])   # seat
    for _, s in SIDES:   # straight legs, barely tapering, a little fuller at the knee
        loft(bm, [round_ring(s * 0.095, y, 0.0, r) for y, r in [(0.14, 0.064), (0.3, 0.066), (0.5, 0.07), (0.7, 0.073), (0.88, 0.078), (0.97, 0.07)]])
pants = single('Pants', 'pants', 'pants', trousers)

for k, s in SIDES:
    single('Sleeve' + k, 'shirt', 'limb' + k, lambda bm: loft(bm, [   # short sleeve, from a rounded shoulder to above the elbow
        round_ring(s * 0.2, 1.635, -0.01, 0.035), round_ring(s * 0.207, 1.605, -0.01, 0.06), round_ring(s * 0.212, 1.53, -0.01, 0.062),
        round_ring(s * 0.215, 1.44, -0.01, 0.059), round_ring(s * 0.215, 1.37, -0.01, 0.057)]))
    single('Forearm' + k, 'fur', 'limb' + k, lambda bm: loft(bm, [   # furry forearm, thickest just below the elbow
        round_ring(s * 0.215, y, -0.01, r) for y, r in [(1.36, 0.036), (1.27, 0.043), (1.17, 0.04), (1.07, 0.033), (1.04, 0.03)]]))

def neck(bm):   # a deer's neck: thick at the base, leaning forward, with a white throat patch at the front
    faces = loft(bm, [round_ring(0, 1.57, -0.005, 0.07, 8, 0.066), round_ring(0, 1.66, 0.01, 0.061), round_ring(0, 1.75, 0.03, 0.055), round_ring(0, 1.83, 0.045, 0.05)])
    for seg in (1, 2):
        faces[seg][7].material_index = 1        # side 7 faces straight forward
single('Neck', ['fur', 'pale'], 'torso', neck)
TAIL = [(0, 0), (0.034, 0.02), (0.042, 0.06), (0.026, 0.1), (0, 0.115), (-0.026, 0.1), (-0.042, 0.06), (-0.034, 0.02)]   # a flat deer tail
single('Tail', 'fur', 'tail', lambda bm: prism(bm, TAIL, 0.018, (0, 0.97, -0.158), (-0.35, 0, 0)))
single('TailUnder', 'white', 'tail', lambda bm: prism(bm, [(x * 0.85, y * 0.92) for x, y in TAIL], 0.012, (0, 0.975, -0.145), (-0.35, 0, 0)))

T_TORSO, T_PANTS = bvh(torso), bvh(pants)

# ---------------------------------------------------------------------------
# Head, lofted from the back of the skull to the nose: big and angular, a long snout,
# wide cheeks. Colors are painted onto chosen faces (see face_ring for the side order:
# sides 0/1/7 are the top, 2/5 the lower flanks, 3/4 the underside).
# ---------------------------------------------------------------------------
HEAD_RINGS = [  # depth z, center height y, half width, height above, height below
    # a deer's head from the side: a rounded skull, a forehead sloping straight down into a long,
    # narrow muzzle; from the front: widest at the eyes, tapering like an upside-down triangle
    (-0.12, 1.89, 0.05, 0.05, 0.05),       # back of the skull
    (-0.08, 1.895, 0.095, 0.09, 0.085),
    (-0.03, 1.895, 0.115, 0.105, 0.095),   # skull, where the ears sit
    (0.02, 1.885, 0.118, 0.095, 0.095),    # eye level: the widest point
    (0.07, 1.865, 0.095, 0.078, 0.085),    # below the eyes
    (0.12, 1.845, 0.072, 0.062, 0.07),     # the muzzle narrows
    (0.17, 1.83, 0.058, 0.052, 0.058),
    (0.22, 1.818, 0.048, 0.045, 0.048),
    (0.255, 1.81, 0.034, 0.033, 0.035),    # nose tip (its flat end is the dark nose)
]
FUR, PALE, LIGHT, DARKFUR, NOSE = 0, 1, 2, 3, 4
def build_head(bm):
    faces = loft(bm, [face_ring(*r) for r in HEAD_RINGS])
    # (sides, see face_ring: 0/7 top, 1/6 upper flanks, 2/5 lower flanks, 3/4 underside)
    for side in (1, 6):                          # light fur around the eyes
        faces[3][side].material_index = LIGHT
    for seg in (4, 5, 6, 7):                     # pale chin and lower muzzle
        for side in (3, 4):
            faces[seg][side].material_index = PALE
    for seg in (6, 7):                           # the muzzle's end is pale on the flanks too
        for side in (2, 5):
            faces[seg][side].material_index = PALE
    for seg in (5, 6, 7):                        # a darker stripe down the bridge of the nose
        for side in (0, 7):
            faces[seg][side].material_index = DARKFUR
    faces[8][0].material_index = NOSE            # the flat tip: the dark nose
head = single('Head', ['fur', 'pale', 'furLight', 'furDark', 'dark'], 'head', build_head)
T_HEAD = bvh(head)

top_y = surf(T_HEAD, (0, 3, 0.0), (0, -1, 0))[0].y
BRIM = top_y - 0.03                    # the hat brim sits just below the top of the skull
EAR_REST = 1.15   # how far the ears are turned out from straight up, as modeled (rig "earRest")
EYE, EYE_N, EAR = {}, {}, {}
for k, s in SIDES:
    # deer eyes sit on the sides of the head: cast in from the side and a little in front
    p, n = surf(T_HEAD, (s * 0.5, 1.9, 0.42), (-s * 0.43, 0, -0.38))
    EYE[k], EYE_N[k] = p - n * 0.008, n
    EAR[k] = surf(T_HEAD, (s * 0.6, BRIM - 0.075, -0.035), (-s, 0, 0))[0] + Vector((-s * 0.015, 0, 0))
nose_p = surf(T_HEAD, (0, 1.81, 0.8), (0, 0, -1))[0]
log('head top %.3f, eyes %s, nose %s' % (top_y, tuple(round(c, 3) for c in EYE['L']), tuple(round(c, 3) for c in nose_p)))

EAR_LEAF = [(0, 0), (0.03, 0.022), (0.047, 0.07), (0.042, 0.118), (0.022, 0.155), (0, 0.172),
            (-0.022, 0.155), (-0.042, 0.118), (-0.047, 0.07), (-0.03, 0.022)]   # a big deer ear, pointed at the tip
for k, s in SIDES:
    # big dark almond eyes set into the side of the face, with a white glint (own bones: they blink)
    single('Eye' + k, 'eye', 'eye' + k, lambda bm: ball(bm, 1, 8, 5, place(EYE[k], aim(EYE_N[k]) @ rot_xyz(0, 0, 0), (0.024, 0.012, 0.03))))
    single('Glint' + k, 'white', 'eye' + k, lambda bm: ball(bm, 0.007, 4, 3, place(EYE[k] + EYE_N[k] * 0.011 + Vector((0, 0.01, 0.008)))))
    # leaf-shaped ears, pink inside, turned out sideways under the brim (EAR_REST) and opened a
    # little toward the front; on their own bones so they can flick
    base = Matrix.Translation(EAR[k]) @ rot_xyz(0, 0, -s * EAR_REST) @ rot_xyz(0, s * 0.45, 0)
    single('Ear' + k, 'fur', 'ear' + k, lambda bm: prism(bm, EAR_LEAF, 0.02, M=base))
    single('EarPink' + k, 'earPink', 'ear' + k, lambda bm: prism(bm, [(x * 0.68, y * 0.8 + 0.02) for x, y in EAR_LEAF], 0.008, M=base @ Matrix.Translation((0, 0, 0.012))))

# ---------- campaign hat: wide flat brim, tall pinched crown, leather band, pine pin ----------
HZ = 0.0  # hat center z
def hat(bm):
    cyl(bm, 0.3, 0.3, 0.014, 14, place((0, BRIM, HZ)))
    # crown: 8 sides with four dents, rising to a pinched "Montana peak" with a front crease
    n = 8
    def ring(y, r_out, r_in, z_off=0.0):
        vs = []
        for i in range(n):
            a = i * math.pi * 2 / n
            r = r_out if i % 2 == 0 else r_in
            vs.append(bm.verts.new(G(math.sin(a) * r, y, HZ + z_off + math.cos(a) * r)))
        return vs
    lo = ring(BRIM + 0.008, 0.158, 0.15)
    mid = ring(BRIM + 0.13, 0.13, 0.105, 0.005)
    hi = ring(BRIM + 0.205, 0.07, 0.045, 0.012)
    top = bm.verts.new(G(0, BRIM + 0.235, HZ + 0.015))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], mid[j], mid[i]))
        bm.faces.new((mid[i], mid[j], hi[j], hi[i]))
        bm.faces.new((hi[i], hi[j], top))
    bm.faces.new(list(reversed(lo)))
single('Hat', 'hat', 'head', hat)
single('HatBand', 'band', 'head', lambda bm: cyl(bm, 0.152, 0.16, 0.05, 8, place((0, BRIM + 0.033, HZ), (0, math.pi / 8, 0))))
single('HatPin', 'pine', 'head', lambda bm: cyl(bm, 0.0, 0.02, 0.045, 4, place((0.075, BRIM + 0.034, HZ + 0.14))))

# ---------- antlers: compact, four tines each side, up through slits in the crown ----------
ANTLER = []  # where each antler starts (for the game: weapon gear decorates the antlers)
for k, s in SIDES:
    by = BRIM + 0.05
    P = lambda x, y, z: (s * x, by + y, z)
    nodes = {
        'b0': (P(0.13, 0.0, -0.02), 0.017), 'b1': (P(0.175, 0.09, -0.03), 0.015), 'b2': (P(0.22, 0.19, -0.045), 0.013),
        'b3': (P(0.265, 0.31, -0.055), 0.01),                                      # the main beam and its tip
        'ta': (P(0.32, 0.11, 0.035), 0.008),                                       # a tine out to the side
        'tb': (P(0.205, 0.37, -0.025), 0.008),                                     # a tine straight up
        'tc': (P(0.335, 0.33, -0.08), 0.008),                                      # a tine up and out
    }
    skin_tree('Antler' + k, 'horn', 'head', nodes, [('b0', 'b1'), ('b1', 'b2'), ('b2', 'b3'), ('b1', 'ta'), ('b2', 'tb'), ('b2', 'tc')], 'b0')
    d = Vector(nodes['b3'][0]) - Vector(nodes['b0'][0])
    ANTLER.append({'pos': [round(c, 4) for c in nodes['b0'][0]], 'rotZ': round(-math.atan2(d.x, d.y), 4)})
    single('Burr' + k, 'hatDark', 'head', lambda bm: ball(bm, 0.024, 6, 4, place((s * 0.13, BRIM + 0.05, -0.02))))   # the slit's rim

# ---------------------------------------------------------------------------
# The uniform's details, sat on the shirt by ray casts (heights from the model sheet)
# ---------------------------------------------------------------------------
front = lambda x, y: surf(T_TORSO, (x, y, 0.6), (0, 0, -1))[0]
rear = lambda x, y: surf(T_TORSO, (x, y, -0.6), (0, 0, 1))[0]
side = lambda tree, s, y: surf(tree, (s * 0.6, y, 0), (-s, 0, 0))[0]

SHIELD = [(-0.037, 0.041), (0.037, 0.041), (0.037, -0.008), (0.0, -0.041), (-0.037, -0.008)]   # badge / patch outline
FLAP = [(-0.06, 0.02), (0.06, 0.02), (0.056, -0.012), (0.0, -0.03), (-0.056, -0.012)]           # pointed pocket flap

def placket(bm):
    box(bm, (0.016, 0.52, 0.012), front(0, 1.34) + Vector((0, 0, 0.002)))
    for _, s in SIDES:
        prism(bm, FLAP, 0.014, front(s * 0.099, 1.47) + Vector((0, 0, 0.004)))
single('ShirtDetails', 'shirtDark', 'chest', placket)
def pockets(bm):  # the pockets themselves: shirt-colored, raised a little so their edges catch the light
    for _, s in SIDES:
        box(bm, (0.105, 0.115, 0.016), front(s * 0.099, 1.405) + Vector((0, 0, 0.0)), bevel=0.004)
single('Pockets', 'shirt', 'chest', pockets)
def buttons(bm):
    for y in (1.47, 1.35, 1.225, 1.11):
        cyl(bm, 0.009, 0.009, 0.008, 6, place(front(0, y) + Vector((0, 0, 0.009)), (math.pi / 2, 0, 0)))
single('Buttons', 'button', 'chest', buttons)
single('Badge', 'brass', 'chest', lambda bm: prism(bm, [(x * 1.2, y * 1.2) for x, y in SHIELD], 0.014, front(0.105, 1.545) + Vector((0, 0, 0.008))))
single('BadgeStar', 'band', 'chest', lambda bm: cyl(bm, 0.0, 0.015, 0.004, 5, place(front(0.105, 1.55) + Vector((0, 0, 0.017)), (math.pi / 2, 0, 0))))
single('NameTag', 'tag', 'chest', lambda bm: box(bm, (0.105, 0.03, 0.008), front(-0.095, 1.53) + Vector((0, 0, 0.004))))
single('NameText', 'pale', 'chest', lambda bm: box(bm, (0.07, 0.008, 0.004), front(-0.095, 1.53) + Vector((0, 0, 0.009))))
def collar(bm):  # collar points either side of the neckerchief
    for _, s in SIDES:
        p = front(s * 0.06, 1.6)
        prism(bm, [(-s * 0.05, 0.03), (s * 0.03, 0.02), (0.0, -0.045)][::s], 0.012, p + Vector((0, 0, 0.008)), (-0.3, 0, 0))
single('Collar', 'shirt', 'chest', collar)
def kerchief(bm):  # a green triangle hanging from the collar
    prism(bm, [(-0.08, 0.035), (0.08, 0.035), (0.0, -0.105)], 0.016, front(0, 1.555) + Vector((0, 0, 0.012)), (-0.15, 0, 0))
single('Kerchief', 'scarf', 'chest', kerchief)
single('KerchiefKnot', 'scarfDark', 'chest', lambda bm: ball(bm, 0.026, 6, 4, place(front(0, 1.6) + Vector((0, 0, 0.02)))))

# ---------- shoulder patches, rolled cuffs, hoof hands ----------
for k, s in SIDES:
    ax = s * 0.215
    sl = surf(bvh(next(o for o, c in PARTS if o.name == 'Sleeve' + k)), (s * 0.6, 1.5, -0.01), (-s, 0, 0))[0]
    single('Patch' + k, 'pantsDark', 'arm' + k, lambda bm: prism(bm, [(x * 0.9, y * 1.1) for x, y in SHIELD], 0.01, sl + Vector((s * 0.004, 0, 0)), (0, s * math.pi / 2, 0)))
    single('PatchRim' + k, 'brass', 'arm' + k, lambda bm: prism(bm, [(x * 1.05, y * 1.25) for x, y in SHIELD], 0.006, sl + Vector((s * 0.001, 0, 0)), (0, s * math.pi / 2, 0)))
    single('Cuff' + k, 'shirtDark', 'arm' + k, lambda bm: cyl(bm, 0.064, 0.062, 0.055, 8, place((ax, 1.36, -0.01))))
    def hoof_hand(bm):
        cyl(bm, 0.036, 0.04, 0.05, 5, place((ax, 1.04, -0.008)))                               # wrist, widening
        cyl(bm, 0.04, 0.03, 0.06, 5, place((ax, 0.985, -0.006)))                               # the hoof, tapering
    single('Hand' + k, 'hoof', 'hand' + k, hoof_hand)
    single('HandSplit' + k, 'dark', 'hand' + k, lambda bm: box(bm, (0.006, 0.045, 0.062), (ax, 0.975, -0.006)))   # the split

# ---------- duty belt: buckle, radio, canteen ----------
BY = 1.02
bx = reach((T_TORSO, T_PANTS), (0.6, BY, 0), (-1, 0, 0), lambda p: p.x) + 0.01     # hug the shirt or trousers, whichever sticks out
bf = reach((T_TORSO, T_PANTS), (0, BY, 0.6), (0, 0, -1), lambda p: p.z) + 0.01
bb = -reach((T_TORSO, T_PANTS), (0, BY, -0.6), (0, 0, 1), lambda p: -p.z) - 0.01
single('Belt', 'leather', 'pelvis', lambda bm: cyl(bm, 1, 1, 0.056, 12, place((0, BY, (bf + bb) / 2), scale=(bx, 1, (bf - bb) / 2))))
single('Buckle', 'brass', 'pelvis', lambda bm: box(bm, (0.064, 0.05, 0.014), (0, BY, bf + 0.004), bevel=0.004))
single('BuckleHole', 'leather', 'pelvis', lambda bm: box(bm, (0.032, 0.022, 0.01), (0, BY, bf + 0.01)))
def radio(bm):   # clipped to the belt on the right front (the Pine Ball satchel hangs further round)
    box(bm, (0.048, 0.09, 0.03), (-0.1, BY - 0.035, bf - 0.005), bevel=0.005)
    cyl(bm, 0.004, 0.004, 0.08, 4, place((-0.115, BY + 0.045, bf - 0.005)))
single('Radio', 'gear', 'pelvis', radio)
single('RadioScreen', 'pine', 'pelvis', lambda bm: box(bm, (0.03, 0.018, 0.006), (-0.1, BY - 0.015, bf + 0.012)))
single('Canteen', 'pack', 'pelvis', lambda bm: ball(bm, 1, 7, 5, place((bx + 0.02, BY - 0.075, 0.02), scale=(0.035, 0.058, 0.05))))
single('CanteenCap', 'gear', 'pelvis', lambda bm: cyl(bm, 0.014, 0.016, 0.022, 6, place((bx + 0.02, BY - 0.008, 0.02))))

# ---------- trousers and boots: cargo pockets, boots ending in split hooves ----------
for k, s in SIDES:
    lx = s * 0.095
    sp = side(T_PANTS, s, 0.62)
    single('Cargo' + k, 'pantsDark', 'thigh' + k, lambda bm: (box(bm, (0.02, 0.13, 0.09), (sp.x - s * 0.002, 0.61, 0.0), bevel=0.004),
                                                               box(bm, (0.024, 0.03, 0.095), (sp.x + s * 0.002, 0.68, 0.0), bevel=0.004)))
    def boot(bm):
        cyl(bm, 0.07, 0.074, 0.12, 8, place((lx, 0.1, 0.004)))                                   # the shaft
        for x in (-0.034, 0.034):                                                                 # two hoof toes
            box(bm, (0.062, 0.052, 0.12), (lx + x, 0.026, 0.035), bevel=0.014)
    single('Boot' + k, 'boot', 'foot' + k, boot)
    single('BootCuff' + k, 'bootCuff', 'foot' + k, lambda bm: cyl(bm, 0.077, 0.077, 0.026, 8, place((lx, 0.166, 0.004))))

# ---------- backpack: big, with a top flap, side pockets, a pine emblem and a bedroll ----------
bz = rear(0, 1.31).z
PZ = bz - 0.08   # the pack's center, 16 cm deep
single('Pack', 'pack', 'chest', lambda bm: box(bm, (0.34, 0.44, 0.16), (0, 1.3, PZ), bevel=0.025))
def pack_dark(bm):
    box(bm, (0.3, 0.13, 0.04), (0, 1.45, PZ - 0.075), (-0.08, 0, 0), bevel=0.012)     # top flap
    for _, s in SIDES:
        box(bm, (0.045, 0.17, 0.11), (s * 0.18, 1.19, PZ), bevel=0.01)                 # side pockets
single('PackDetails', 'packDark', 'chest', pack_dark)
single('PackStrap', 'leather', 'chest', lambda bm: box(bm, (0.04, 0.07, 0.01), (0, 1.38, PZ - 0.098)))
single('PackBuckle', 'brass', 'chest', lambda bm: box(bm, (0.03, 0.022, 0.012), (0, 1.36, PZ - 0.102)))
EZ = PZ - 0.083   # the back face of the pack
single('Emblem', 'emblem', 'chest', lambda bm: cyl(bm, 0.07, 0.07, 0.012, 12, place((0, 1.2, EZ), (math.pi / 2, 0, 0))))
single('EmblemRim', 'brass', 'chest', lambda bm: cyl(bm, 0.076, 0.076, 0.006, 12, place((0, 1.2, EZ + 0.004), (math.pi / 2, 0, 0))))
def pine(bm):  # a little three-tier pine on the emblem
    for y, r in ((1.17, 0.045), (1.2, 0.035), (1.23, 0.025)):
        prism(bm, [(-r, 0.0), (r, 0.0), (0.0, 0.045)], 0.008, (0, y - 0.02, EZ - 0.01))
single('EmblemPine', 'pine', 'chest', pine)
single('Bedroll', 'bedroll', 'chest', lambda bm: cyl(bm, 0.05, 0.05, 0.44, 8, place((0, 1.57, PZ + 0.01), (0, 0, math.pi / 2))))
def bedroll_straps(bm):
    for x in (-0.13, 0.13):
        cyl(bm, 0.054, 0.054, 0.026, 8, place((x, 1.57, PZ + 0.01), (0, 0, math.pi / 2)))
single('BedrollStraps', 'leather', 'chest', bedroll_straps)
def shoulder_straps(bm):  # pack straps over the shoulders, down the back to the pack
    for _, s in SIDES:
        a, b = rear(s * 0.11, 1.58), rear(s * 0.12, 1.5)
        box(bm, (0.03, 0.12, 0.012), (a + b) / 2 + Vector((0, 0.02, -0.006)), aim(a - b))
single('PackStraps', 'leather', 'chest', shoulder_straps)

# ---------------------------------------------------------------------------
# Armature (the game's bones, same names and positions as js/deer.js)
# ---------------------------------------------------------------------------
BONES = [  # name, parent, head, tail (game space)
    ('pelvis', None, (0, 1.0, 0), (0, 1.16, 0)), ('spine', 'pelvis', (0, 1.16, 0), (0, 1.36, 0)),
    ('chest', 'spine', (0, 1.36, 0), (0, 1.63, 0.01)), ('neck', 'chest', (0, 1.63, 0.01), (0, 1.76, 0.02)),
    ('head', 'neck', (0, 1.76, 0.02), (0, 1.96, 0.02)), ('tail', 'pelvis', (0, 1.0, -0.12), (0, 1.08, -0.16)),
]
for k, s in SIDES:
    BONES += [
        ('arm' + k, 'chest', (s * 0.215, 1.58, -0.01), (s * 0.215, 1.29, -0.01)),
        ('fore' + k, 'arm' + k, (s * 0.215, 1.29, -0.01), (s * 0.215, 1.03, -0.01)),
        ('hand' + k, 'fore' + k, (s * 0.215, 1.03, -0.01), (s * 0.215, 0.94, -0.01)),
        ('thigh' + k, 'pelvis', (s * 0.095, 0.95, 0), (s * 0.095, 0.51, 0)),
        ('shin' + k, 'thigh' + k, (s * 0.095, 0.51, 0), (s * 0.095, 0.09, 0)),
        ('foot' + k, 'shin' + k, (s * 0.095, 0.09, 0), (s * 0.095, 0.09, 0.1)),
        ('ear' + k, 'head', tuple(EAR[k]), tuple(EAR[k] + Vector((s * 0.14, 0.05, 0)))),
        ('eye' + k, 'head', tuple(EYE[k]), tuple(EYE[k] + Vector((0, 0, 0.03)))),
    ]
# ---------------------------------------------------------------------------
# Skinning: weights along each chain of bones, blending across each joint
# ---------------------------------------------------------------------------
TORSO = (['pelvis', 'spine', 'chest', 'neck', 'head'], [(1.14, 0.05), (1.36, 0.06), (1.64, 0.04), (1.77, 0.04)])
def leg(y, k):
    return chain(y, ['foot' + k, 'shin' + k, 'thigh' + k, 'pelvis'], [(0.13, 0.03), (0.51, 0.05), (0.97, 0.05)])
def arm(y, k):
    return chain(y, ['hand' + k, 'fore' + k, 'arm' + k, 'chest'], [(1.04, 0.03), (1.29, 0.04), (1.6, 0.04)])

def weights_for(name, p):
    if name == 'torso':
        return chain(p.y, *TORSO)
    if name == 'pants':
        return chain(p.y, *TORSO) if p.y > 1.03 else leg(p.y, 'L' if p.x >= 0 else 'R')
    if name in ('limbL', 'limbR'):
        return arm(p.y, name[-1])
    return None

SKINNED = ('torso', 'pants', 'limbL', 'limbR')   # weight-chain names (anything else is a bone name: rigid)
# facts for the game: how far the ears are modeled turned out; where the antlers start
rig('RangerRig', BONES, weights_for, SKINNED, {'earRest': EAR_REST, 'antlers': ANTLER})

# ---------------------------------------------------------------------------
# Save and export
# ---------------------------------------------------------------------------
total = sum(len(ob.data.polygons) for ob, _ in PARTS)
log('%d parts, %d faces in all' % (len(PARTS), total))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'ranger.blend'), check_existing=False)
pinewood_export.export('ranger', log=log)
