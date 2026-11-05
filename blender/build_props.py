"""
build_props.py — models the game's props in Blender: the things creatures drop (the heart, the
XP magnet, the XP gem and the coin; js/pickups.js uses them) and the Hollow King cult's fixtures
scattered through the forest (altar, standing stone, totem, wicker effigy, ground sigil,
candles; js/world.js places them). Saves blender/props.blend and exports js/models/props.js
(PINEWOOD_MODELS.props.<name>).

  blender-launcher --background --factory-startup --python blender\\run.py -- build_props

Each prop is an Empty (named after the prop) with its meshes parented to it; they sit side by
side in the .blend so you can see them all. Sizes are what the game shows at scale 1:
  heart, magnet  about half a meter across (they bob at full size)
  gem, coin      radius 1 (the game scales each orb and coin to its value)
Same rules as every model here (pwkit.py): flat-shaded, low-poly, deliberate facets.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pinewood_export
from pwkit import *

set_log('build_props')
reset_scene()
palette([
    ('heart', 'e0384a', 0.55, 0.0, 0.3),      # glowing a little, so it reads from far away
    ('heartShine', 'ffb3bd', 0.4, 0.0, 0.5),
    ('magnetRed', 'c8392b', 0.5, 0.0, 0.12),
    ('steel', 'd8dde0', 0.35, 0.3),
    ('xp', '8fd0ff', 0.25, 0.0, 0.85),         # almost all glow: XP gems should pop
    ('gold', 'f2c14e', 0.4, 0.2, 0.3),
    ('goldDark', 'c9962e', 0.45, 0.2, 0.2),
])

def prop(name, x):
    """An Empty for one prop, placed at x in the .blend (the export uses its own space)."""
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.2
    COLL[0].objects.link(e)
    e.location = G(x, 0, 0)
    return e

def attach(empty, *objs):
    for o in objs:
        o.parent = empty
    bpy.context.view_layer.update()

# ---------------------------------------------------------------------------
# Heart: a puffy, faceted 3D heart, lofted from the classic heart outline
# ---------------------------------------------------------------------------
def heart_outline(n=20, k=0.016):
    """The heart curve (x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t), n points, scaled by k."""
    pts = []
    for i in range(n):
        t = i * 2 * math.pi / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x * k, y * k + 0.03))
    return pts

OUT = heart_outline()
def heart(bm):
    # rings of the outline, shrunk toward the middle at the front and back faces: a pillow shape
    layers = [(0.2, -0.115), (0.62, -0.095), (0.9, -0.055), (1.0, 0.0), (0.9, 0.055), (0.62, 0.095), (0.2, 0.115)]
    loft(bm, [[(x * f, (y - 0.02) * f + 0.02, z) for x, y in OUT] for f, z in layers])
def shine(bm):   # a little highlight on the upper left lobe, on the front
    prism(bm, [(0.0, 0.03), (0.035, 0.015), (0.03, -0.015), (-0.005, -0.03), (-0.03, -0.01), (-0.025, 0.02)], 0.01, (-0.105, 0.15, 0.1), (-0.5, -0.4, 0.5))
e = prop('heart', 0.0)
attach(e, single('Heart', 'heart', None, heart), single('HeartShine', 'heartShine', None, shine))

# ---------------------------------------------------------------------------
# Magnet: a horseshoe swept along its curve, red with steel tips
# ---------------------------------------------------------------------------
R = 0.17
PATH = [(-R, -0.17, 0), (-R, -0.1, 0), (-R, -0.02, 0)] + \
       [(math.cos(a) * R, math.sin(a) * R, 0) for a in (math.radians(d) for d in (155, 125, 90, 55, 25))] + \
       [(R, -0.02, 0), (R, -0.1, 0), (R, -0.17, 0)]
def magnet(bm):
    sweep(bm, PATH, 0.062, n=6)
    for f in bm.faces:   # everything below the bend of the legs is the steel tips
        if back(f.calc_center_median()).y < -0.095:
            f.material_index = 1
e = prop('magnet', 0.8)
attach(e, single('Magnet', ['magnetRed', 'steel'], None, magnet))

# ---------------------------------------------------------------------------
# XP gem: a cut crystal (flat table on top, a crown, a pointed pavilion below)
# ---------------------------------------------------------------------------
def gem(bm):
    ring = lambda y, r, turn: [(math.sin(i * math.pi / 4 + turn) * r, y, math.cos(i * math.pi / 4 + turn) * r) for i in range(8)]
    # each ring turned half a step from the last, so the facets zig-zag like a cut stone
    loft(bm, [ring(0.55, 0.5, 0), ring(0.28, 0.95, math.pi / 8), ring(0.08, 1.0, 0), ring(-1.0, 0.02, math.pi / 8)])
e = prop('gem', 1.6)
attach(e, single('Gem', 'xp', None, gem))

# ---------------------------------------------------------------------------
# Coin: a gold disc (facing +Z) with a raised rim and a pine stamped on both faces
# ---------------------------------------------------------------------------
def coin(bm):
    cyl(bm, 1.0, 1.0, 0.18, 12, place((0, 0, 0), (math.pi / 2, 0, 0)))
def coin_rim(bm):   # a raised ring on each face
    for s in (1, -1):
        rings = [round_ring(0, 0, 0, r, 12) for r in (0.96, 0.96, 0.8, 0.8)]
        zs = [0.09, 0.125, 0.125, 0.09]
        rings = [[(x, z, s * zz) for x, _, z in ring] for ring, zz in zip(rings, zs)]   # lay the rings flat on the face
        loft(bm, rings + [rings[0]], False, False)
def coin_pine(bm):  # a three-tier pine, stamped on both faces
    for s in (1, -1):
        for y, r in ((-0.25, 0.42), (0.05, 0.33), (0.32, 0.22)):
            prism(bm, [(-r, -0.12), (r, -0.12), (0.0, 0.2)], 0.05, (0, y, s * 0.1))
        box(bm, (0.12, 0.16, 0.05), (0, -0.45, s * 0.1))
e = prop('coin', 2.6)
attach(e, single('Coin', 'gold', None, coin), single('CoinRim', 'goldDark', None, coin_rim), single('CoinPine', 'goldDark', None, coin_pine))

# ===========================================================================
# THE CULT OF THE HOLLOW KING
# The forest is scattered with what his worshippers left behind: ritual sites (a glowing sigil
# burned into the ground, an altar, a ring of carved standing stones, candles), antlered totems
# and wicker effigies. world.js places them (buildWorld → cult sites). All of them carry the
# King's sigil: a ring, a pair of antlers, a crown between them and a skull below.
# Sizes are real meters; each prop's origin is on the ground at its center, facing +Z.
# ===========================================================================
palette([
    ('cultStone', '4a4652', 0.95), ('cultStoneDark', '34313a', 0.95),
    ('crimson', '6a1418', 0.85), ('bone', 'd8cbb0', 0.7), ('void', '050304'),
    ('wax', 'd8ceb4', 0.8), ('waxRed', '7a1a1c', 0.8), ('flame', 'ffb050', 0.4, 0.0, 1.0),
    ('sigil', 'ff4a24', 0.5, 0.0, 1.0),
    ('cultWood', '3a2a1e', 1.0), ('rope', '8a7650', 1.0), ('wicker', '8a6a40', 1.0), ('rust', '8a5a3a', 0.55, 0.5),
])
V = Vector

def king_sigil(bm, c, s, right, up, w):
    """The Hollow King's sigil, drawn in strokes `w` thick on the plane through c spanned by `right` and
    `up` (unit game vectors), radius s: a ring, two antlers with tines, a crown between them, a skull below."""
    c, right, up = V(c), V(right), V(up)
    normal = right.cross(up)
    at = lambda u, v: tuple(c + right * (u * s) + up * (v * s))
    def stroke(pts, ww=w):
        sweep(bm, [at(u, v) for u, v in pts], ww, 4, up=tuple(normal))
    hoop(bm, c, s, w, 20, 4, up=tuple(normal))
    for k in (-1, 1):   # antlers: a sweeping beam with two tines each
        stroke([(k * 0.06, -0.02), (k * 0.3, 0.26), (k * 0.42, 0.62), (k * 0.36, 0.86)])
        stroke([(k * 0.3, 0.26), (k * 0.6, 0.36)])
        stroke([(k * 0.38, 0.48), (k * 0.2, 0.66)])
    stroke([(-0.2, 0.06), (-0.2, 0.3), (-0.1, 0.16), (0.0, 0.4), (0.1, 0.16), (0.2, 0.3), (0.2, 0.06), (-0.2, 0.06)])   # the crown
    stroke([(-0.16, -0.12), (0.16, -0.12), (0.0, -0.52), (-0.16, -0.12)])                                               # the skull
    for k in (-1, 1):
        blob(bm, at(k * 0.06, -0.22), w * 1.2, w * 1.2, w * 1.2, 4, 3)                                                  # its eyes

def deer_skull(bm, at, face, s=1.0):
    """A deer skull (cranium and long snout) at `at`, the snout toward `face` (an angle about Y)."""
    f = V((math.sin(face), 0, math.cos(face)))
    at = V(at)
    egg(bm, at, 0.11 * s, 0.1 * s, 0.11 * s, 8, 5)
    tube(bm, at + f * 0.06 * s + V((0, -0.02 * s, 0)), at + f * 0.28 * s + V((0, -0.08 * s, 0)), 0.07 * s, 0.035 * s, 6)

def skull_sockets(bm, at, face, s=1.0):
    f, r = V((math.sin(face), 0, math.cos(face))), V((math.cos(face), 0, -math.sin(face)))
    for k in (-1, 1):
        blob(bm, V(at) + f * 0.085 * s + r * (k * 0.055 * s) + V((0, 0.01 * s, 0)), 0.03 * s, 0.025 * s, 0.025 * s, 5, 3)

def antlers(name, at, face, s=1.0):
    """A pair of antlers rising from a skull at `at`."""
    f, r = V((math.sin(face), 0, math.cos(face))), V((math.cos(face), 0, -math.sin(face)))
    at = V(at)
    nodes, edges = {}, []
    for k in (-1, 1):
        p = lambda x, y, z: tuple(at + r * (k * x * s) + V((0, y * s, 0)) + f * (z * s))   # (out to the side, up, forward)
        for key, pt, rad in (('a', (0.07, 0.07, -0.02), 0.025), ('b', (0.24, 0.28, -0.06), 0.018), ('c', (0.32, 0.55, -0.12), 0.01),
                             ('t', (0.38, 0.38, 0.06), 0.007), ('u', (0.16, 0.5, -0.04), 0.007)):
            nodes['%s%d' % (key, k)] = (p(*pt), rad * s)
        edges += [('a%d' % k, 'b%d' % k), ('b%d' % k, 'c%d' % k), ('b%d' % k, 't%d' % k), ('b%d' % k, 'u%d' % k)]
    nodes['root'] = (tuple(at), 0.03 * s)
    edges += [('root', 'a-1'), ('root', 'a1')]
    return skin_tree(name, 'bone', None, nodes, edges, 'root', False)

def candle(bm_wax, bm_flame, at, h, r=0.04):
    """A candle at `at` (its base), h tall, with a drip of wax round the base; its flame goes in bm_flame."""
    at = V(at)
    cyl(bm_wax, r, r * 1.05, h, 6, place(at + V((0, h / 2, 0))))
    cyl(bm_wax, r * 1.1, r * 1.9, 0.03, 6, place(at + V((0, 0.015, 0))))
    blob(bm_flame, at + V((0, h + 0.045, 0)), r * 0.55, r * 1.3, r * 0.55, 4, 3)

# ---------------------------------------------------------------------------
# Altar: a rough stone table on two blocks, a crimson runner over it, a deer skull with antlers in
# the middle, offered bones and four candles. Candle flames (for the game's glow sprites) at
# (±0.7, 1.13, ±0.32).
# ---------------------------------------------------------------------------
def altar_stone(bm):
    box(bm, (1.8, 0.2, 0.95), (0, 0.86, 0), (0, 0, 0), 0.04)
    for x in (-0.6, 0.6):
        box(bm, (0.42, 0.78, 0.7), (x, 0.38, 0), (0, 0, 0), 0.05)
def altar_cloth(bm):
    box(bm, (0.55, 0.02, 1.0), (0, 0.97, 0))
    for z in (-1, 1):   # the ends hang down, cut ragged
        prism(bm, [(-0.27, 0), (0.27, 0), (0.27, -0.42), (0.14, -0.34), (0.0, -0.46), (-0.14, -0.34), (-0.27, -0.42)], 0.02, (0, 0.97, z * 0.5))
def altar_bones(bm):
    deer_skull(bm, (0, 1.08, -0.05), 0.0)
    for x, a in ((-0.35, 0.4), (0.38, -0.3)):   # long bones laid in offering
        tube(bm, (x - math.sin(a) * 0.18, 1.0, -math.cos(a) * 0.18), (x + math.sin(a) * 0.18, 1.0, math.cos(a) * 0.18), 0.022, 0.022, 5)
        for e in (-1, 1):
            blob(bm, (x + e * math.sin(a) * 0.19, 1.0, e * math.cos(a) * 0.19), 0.035, 0.03, 0.035, 5, 3)
e = prop('altar', 4.0)
wax, fl = bmesh.new(), bmesh.new()
for x in (-0.7, 0.7):
    for z in (-0.32, 0.32):
        candle(wax, fl, (x, 0.96, z), 0.12 + abs(x + z) * 0.08)
attach(e, single('AltarStone', 'cultStone', None, altar_stone), single('AltarCloth', 'crimson', None, altar_cloth),
       single('AltarBones', 'bone', None, altar_bones), single('AltarSockets', 'void', None, lambda bm: skull_sockets(bm, (0, 1.08, -0.05), 0.0)),
       antlers('AltarAntlers', (0, 1.13, -0.08), 0.0), make('AltarWax', wax, 'wax', None), make('AltarFlames', fl, 'flame', None),
       single('AltarSigil', 'sigil', None, lambda bm: king_sigil(bm, (0, 0.76, 0.515), 0.17, (1, 0, 0), (0, 1, 0), 0.014)))   # on the cloth's front

# ---------------------------------------------------------------------------
# Standing stone: a tall, leaning slab, roughly cut, with the King's sigil carved glowing into
# its face (at 1.5 m) and a few runes down its edge
# ---------------------------------------------------------------------------
def monolith(bm):
    # a flat front face (for the carving) and a roughly cut back; rings taper and shift as it rises
    ring = lambda y, w, d, sx=0.0: [(sx + x * w, y, z * d) for x, z in ((0.62, 1.0), (1.0, 0.3), (0.9, -0.6), (0.4, -1.0), (-0.45, -0.95), (-0.95, -0.55), (-1.0, 0.3), (-0.62, 1.0))]
    loft(bm, [ring(-0.3, 0.44, 0.24), ring(0.6, 0.46, 0.25), ring(1.6, 0.41, 0.23), ring(2.3, 0.31, 0.19, 0.02), ring(2.62, 0.12, 0.08, 0.06)])
st = single('Monolith', 'cultStone', None, monolith)
T = bvh(st)
face = surf(T, (0, 1.5, 2), (0, 0, -1))[0]
e = prop('monolith', 5.5)
attach(e, st, single('MonolithSigil', 'sigil', None, lambda bm: (king_sigil(bm, face + V((0, 0, 0.01)), 0.2, (1, 0, 0), (0, 1, 0), 0.02),
                                                              [box(bm, (0.08, 0.025, 0.02), surf(T, (0, y, 2), (0, 0, -1))[0], (0, 0, 0.5 * (-1) ** i)) for i, y in enumerate((0.55, 0.75, 0.95))])))

# ---------------------------------------------------------------------------
# Totem: a crooked pole lashed with rope, a crossbar hung with bones and crimson rags, and an
# antlered deer skull on top
# ---------------------------------------------------------------------------
def totem_wood(bm):
    sweep(bm, [(0, -0.2, 0), (0.03, 1.2, 0.01), (-0.02, 2.4, 0.0), (0.0, 2.95, 0.02)], [0.11, 0.1, 0.085, 0.07], 6)
    tube(bm, (-0.6, 2.3, 0.05), (0.6, 2.36, 0.05), 0.05, 0.045, 5)
def totem_rope(bm):
    for y in (0.9, 1.05, 2.33):
        hoop(bm, (0.02, y, 0.01), 0.11, 0.018, 8, 3)
def totem_rags(bm):
    for x, ln in ((-0.45, 0.6), (0.18, 0.75), (0.5, 0.5)):
        prism(bm, [(-0.07, 0), (0.07, 0), (0.06, -ln), (0.0, -ln + 0.12), (-0.06, -ln)], 0.015, (x, 2.33, 0.1), (0, 0, 0.05))
def totem_bones(bm):
    deer_skull(bm, (0.0, 3.02, 0.03), 0.0, 1.3)
    for x in (-0.3, 0.35):   # bones on cords
        tube(bm, (x, 2.32, 0.05), (x, 1.92, 0.05), 0.006, 0.006, 3)
        tube(bm, (x - 0.05, 1.9, 0.05), (x + 0.05, 1.8, 0.05), 0.022, 0.02, 5)
    blob(bm, (-0.58, 2.3, 0.05), 0.06, 0.05, 0.06, 5, 3)
e = prop('totem', 7.0)
attach(e, single('TotemWood', 'cultWood', None, totem_wood), single('TotemRope', 'rope', None, totem_rope), single('TotemRags', 'crimson', None, totem_rags),
       single('TotemBones', 'bone', None, totem_bones), single('TotemSockets', 'void', None, lambda bm: skull_sockets(bm, (0.0, 3.02, 0.03), 0.0, 1.3)),
       antlers('TotemAntlers', (0.0, 3.1, 0.0), 0.0, 1.5))

# ---------------------------------------------------------------------------
# Effigy: a wicker figure of the Hollow King, 3 m tall, lashed to a post: woven limbs, a skull
# head with great antlers and a rusted crown, its arms spread, a crimson sash
# ---------------------------------------------------------------------------
def effigy_wicker(bm):
    for x in (-1, 1):   # legs and arms: bundles of three swept strands each
        for k in range(3):
            o = V(((k - 1) * 0.035, 0, ((k % 2) - 0.5) * 0.04))
            sweep(bm, [V((x * 0.2, -0.1, 0)) + o, V((x * 0.18, 0.7, 0.02)) + o, V((x * 0.12, 1.3, 0)) + o], 0.045, 4)
            sweep(bm, [V((x * 0.26, 2.15, 0)) + o, V((x * 0.65, 2.36, 0.05)) + o, V((x * 1.1, 2.2, 0.12)) + o], 0.042, 4)
        for i in range(5):   # long splayed twig fingers
            spike(bm, (x * 1.1, 2.2, 0.12), (x * 1, 0.5 - i * 0.3, 0.25), 0.016, 0.38, 3)
        hoop(bm, (x * 0.17, 0.55, 0.01), 0.1, 0.022, 6, 3)   # bindings round the legs
    # the body: a woven cage, ribs bulging out round a hollow chest
    for i in range(10):
        a = i / 10 * math.pi * 2
        sweep(bm, [(math.sin(a) * r, y, math.cos(a) * r * 0.8) for y, r in ((1.2, 0.16), (1.55, 0.36), (1.95, 0.4), (2.3, 0.24), (2.42, 0.1))], 0.026, 4)
    for y, r in ((1.55, 0.36), (1.95, 0.4), (2.3, 0.24)):   # woven bands round it
        hoop(bm, (0, y, 0), r, 0.03, 10, 3)
    egg(bm, (0, 2.66, 0.02), 0.22, 0.26, 0.22, 8, 5)   # the woven head
def effigy_post(bm):
    sweep(bm, [(0, -0.3, -0.25), (0.02, 1.5, -0.24), (0, 3.0, -0.25)], [0.1, 0.09, 0.08], 6)
    tube(bm, (-0.9, 2.32, -0.18), (0.9, 2.32, -0.18), 0.06, 0.06, 5)
def effigy_bone(bm):
    deer_skull(bm, (0, 2.7, 0.14), 0.0, 1.4)
e = prop('effigy', 9.0)
attach(e, single('EffigyWicker', 'wicker', None, effigy_wicker), single('EffigyPost', 'cultWood', None, effigy_post),
       single('EffigySkull', 'bone', None, effigy_bone), single('EffigySockets', 'void', None, lambda bm: skull_sockets(bm, (0, 2.7, 0.14), 0.0, 1.4)),
       antlers('EffigyAntlers', (0, 2.82, 0.08), 0.0, 2.6),
       single('EffigyCrown', 'rust', None, lambda bm: (hoop(bm, (0, 2.86, 0.06), 0.17, 0.025, 10, 4), [spike(bm, (math.sin(a) * 0.17, 2.88, 0.06 + math.cos(a) * 0.17), (0, 1, 0), 0.03, 0.14, 4) for a in (i * 2 * math.pi / 7 for i in range(7))])),
       single('EffigySash', 'crimson', None, lambda bm: (hoop(bm, (0, 1.3, 0.0), 0.2, 0.045, 8, 3), prism(bm, [(-0.07, 0), (0.07, 0), (0.06, -0.8), (0, -0.68), (-0.06, -0.8)], 0.015, (0.12, 1.3, 0.2)))),
       single('EffigyRope', 'rope', None, lambda bm: [hoop(bm, (0, y, -0.2), 0.12, 0.02, 8, 3) for y in (1.4, 2.3)]))

# ---------------------------------------------------------------------------
# Ground sigil: the King's sigil burned glowing into the earth, 3.2 m across the outer ring, with a
# second ring and runes between them. The game sinks it slightly into the ground.
# ---------------------------------------------------------------------------
def ground_sigil(bm):
    king_sigil(bm, (0, 0.03, 0), 2.6, (1, 0, 0), (0, 0, -1), 0.07)
    hoop(bm, (0, 0.03, 0), 3.2, 0.07, 28, 4)
    for i in range(10):   # runes between the rings: a stroke and a tick
        a = i / 10 * math.pi * 2 + 0.3
        r, t = V((math.sin(a), 0, math.cos(a))), V((math.cos(a), 0, -math.sin(a)))
        p = V((0, 0.03, 0)) + r * 2.9
        sweep(bm, [tuple(p - t * 0.12), tuple(p + t * 0.12)], 0.05, 4)
        sweep(bm, [tuple(p + t * (0.06 * (-1) ** i)), tuple(p + t * (0.06 * (-1) ** i) + r * 0.15)], 0.04, 4)
e = prop('sigil', 12.0)
attach(e, single('GroundSigil', 'sigil', None, ground_sigil))

# ---------------------------------------------------------------------------
# Candles: a cluster of five on the ground, red and pale, half melted. Flames at the heights
# given in CANDLES (the game puts a glow on each).
# ---------------------------------------------------------------------------
CANDLES = [((0.0, 0.0), 0.32), ((0.16, 0.08), 0.22), ((-0.12, 0.14), 0.18), ((0.08, -0.15), 0.26), ((-0.17, -0.08), 0.12)]
wax, red, fl = bmesh.new(), bmesh.new(), bmesh.new()
for i, ((x, z), hgt) in enumerate(CANDLES):
    candle(red if i % 2 else wax, fl, (x, 0, z), hgt, 0.05)
e = prop('candles', 15.0)
attach(e, make('CandleWax', wax, 'wax', None), make('CandleRed', red, 'waxRed', None), make('CandleFlames', fl, 'flame', None))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'props.blend'), check_existing=False)
pinewood_export.export_props('props', log=log)
