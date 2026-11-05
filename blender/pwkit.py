"""
pwkit.py — the shared modeling toolkit for every Pinewood build script in this folder
(build_ranger.py, build_props.py, build_creatures.py). Import it with `from pwkit import *`.

WHAT'S IN IT
  - Coordinates: models are written in GAME space (Y up, facing +Z, the model's left is +X);
    G() turns a game point into Blender space (Z up, facing -Y), back() turns it back.
  - Materials: material(name, hex, rough, metal, emit) registers a flat game material.
  - Shapes, all low-poly and flat-shaded, added into a bmesh:
      cyl, ball, box (optionally beveled), prism (a flat cut-out outline, given thickness),
      loft (cross-section rings joined by quads: the main way bodies are modeled),
      sweep (a ring dragged along a path: horseshoes, tails, tentacles), skin_tree (branching
      antlers, roots and twigs via Blender's Skin modifier).
    Ring shapes for lofting: round_ring, oval_ring, box_ring, face_ring.
  - make / single: turn a bmesh into an object with its material(s), remembered in PARTS
    with what drives it: a bone name (rigid) or a weight-chain name (skinned).
  - Ray casting (bvh, surf, reach) to sit details exactly on a surface.
  - rig(): build an armature from a bone list and attach every part (rigid parts parented to
    their bone; skinned parts weighted by a function).

STYLE RULES (the game's look): flat shading, few sides, every facet deliberate and the two
sides mirrored. Detail comes from more shapes and painted faces, never from smoothing.
Don't use metaballs or the Decimate modifier: they leave random, lopsided triangles.
"""
import bpy, bmesh, math, os, json
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Logging (the Store version of Blender shows no console: run.py and log() write files)
# ---------------------------------------------------------------------------
LOG_PATH = [os.path.join(HERE, 'build_log.txt')]
def set_log(name):
    LOG_PATH[0] = os.path.join(HERE, name + '_log.txt')

def log(s):
    """Append a line to the current build's log right away (so it's there even if a later step fails)."""
    with open(LOG_PATH[0], 'a', encoding='utf-8') as f:
        f.write(str(s) + '\n')

# ---------------------------------------------------------------------------
# Coordinates
# ---------------------------------------------------------------------------
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # game → Blender
CI = C.inverted()

def G(x, y, z):
    """A game-space point as a Blender vector."""
    return Vector((x, -z, y))

def back(v):
    """A Blender vector as a game-space point."""
    return Vector((v.x, v.z, -v.y))

def rot_xyz(rx, ry, rz):
    """A rotation like three.js Euler(rx, ry, rz) (applied Z, then Y, then X), in game space."""
    return Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rz, 4, 'Z')

def aim(d):
    """A rotation turning game +Y toward direction d."""
    return Vector((0, 1, 0)).rotation_difference(Vector(d).normalized()).to_matrix().to_4x4()

def place(pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    """A game-space transform (position, Euler tuple or 4x4 matrix, scale) as a Blender matrix."""
    R = rot if isinstance(rot, Matrix) else rot_xyz(*rot)
    T = Matrix.Translation(Vector(pos)) @ R @ Matrix.Diagonal(Vector((*scale, 1)))
    return C @ T @ CI

# ---------------------------------------------------------------------------
# Scene and materials
# ---------------------------------------------------------------------------
COLL = [None]
MAT = {}
PARTS = []  # (object, bone name for rigid parts, or a weight-chain name for skinned parts)

def reset_scene():
    """Empty the scene (and the toolkit's lists) before building."""
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    COLL[0] = bpy.context.scene.collection
    MAT.clear()
    PARTS.clear()

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def material(name, hexcol, rough=0.85, metal=0.0, emit=0.0):
    """Register a material. Its viewport color is what the game uses; emit (0–1) makes it glow
    that much of its own color in the game (custom property "emit")."""
    rgb = [int(hexcol[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [_lin(c) for c in rgb]
    m = bpy.data.materials.new(name)
    gamma = bpy.types.Material.bl_rna.properties['diffuse_color'].subtype == 'COLOR_GAMMA'
    m.diffuse_color = (*(rgb if gamma else lin), 1)
    m.roughness, m.metallic = rough, metal
    if emit:
        m['emit'] = emit
    try:  # the render material too, so it looks right in Material Preview / renders
        if hasattr(m, 'use_nodes'):
            m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*lin, 1)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
    except Exception:
        pass
    MAT[name] = m

def palette(entries):
    """Register many materials: [(name, hex, rough?, metal?, emit?), ...]."""
    for e in entries:
        material(*e)

# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------
def make(name, bm, mat, bone):
    """Turn a bmesh into a flat-shaded object, attached to `bone` later (or skinned by a chain).
    mat: one material name, or a list of names (faces pick one with face.material_index)."""
    me = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)   # every face wound to point outward (the game hides back faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    ob = bpy.data.objects.new(name, me)
    COLL[0].objects.link(ob)
    for m in ([mat] if isinstance(mat, str) else mat):
        me.materials.append(MAT[m])
    PARTS.append((ob, bone))
    return ob

def single(name, mat, bone, fn):
    """One part: fn(bm) adds its shapes."""
    bm = bmesh.new()
    fn(bm)
    return make(name, bm, mat, bone)

def cyl(bm, r_top, r_bot, h, n, M):
    """A cylinder/cone along game Y (like THREE.CylinderGeometry(rTop, rBottom, h, n)), placed by M."""
    return bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=n, radius1=r_bot, radius2=r_top, depth=h, matrix=M)

def ball(bm, r, u, v, M):
    return bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r, matrix=M)

def box(bm, size, pos, rot=(0, 0, 0), bevel=0.0):
    """A box of game size (sx, sy, sz), optionally with beveled edges (a softer, crafted look)."""
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=place(pos, rot, size))
    if bevel:
        verts = res['verts']
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges + verts, offset=bevel, segments=1, affect='EDGES', profile=0.5)
    return res

def prism(bm, pts, depth, pos=(0, 0, 0), rot=(0, 0, 0), M=None):
    """A flat cut-out shape: the outline `pts` [(x, y), ...] (in meters), `depth` thick, facing
    game +Z, placed at pos/rot, or by M (a game-space 4x4 matrix). For badges, patches, flaps, ears."""
    M = place(pos, rot) if M is None else C @ M @ CI
    front = [bm.verts.new(M @ G(x, y, depth / 2)) for x, y in pts]
    rear = [bm.verts.new(M @ G(x, y, -depth / 2)) for x, y in pts]
    bm.faces.new(front)
    bm.faces.new(list(reversed(rear)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], rear[i], rear[j], front[j]))

def evaluated_mesh(ob):
    """The mesh an object shows with its modifiers applied."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)

# ---------- lofting: hand-placed cross-section rings joined by quads ----------
def loft(bm, rings, cap_start=True, cap_end=True):
    """Join rings of game-space points (all the same count, in the same order) with quads,
    closing each end with one flat face. Returns the bmesh faces between rings as
    faces[segment][side] (side i runs from point i to point i+1), for painting colors;
    the end cap, if any, is faces[-1][0]."""
    vs = [[bm.verts.new(G(*p)) for p in ring] for ring in rings]
    n = len(rings[0])
    faces = []
    for a, b in zip(vs, vs[1:]):
        faces.append([bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])) for i in range(n)])
    if cap_start:
        bm.faces.new(list(reversed(vs[0])))
    if cap_end:
        faces.append([bm.faces.new(vs[-1])])
    return faces

def box_ring(y, w, d, c, z=0.0):
    """A horizontal cross-section at height y: a w-by-d (half sizes) rectangle with its corners cut
    by c, i.e. a boxy octagon, centered at depth z."""
    return [(w - c, y, z + d), (w, y, z + d - c), (w, y, z - d + c), (w - c, y, z - d),
            (-(w - c), y, z - d), (-w, y, z - d + c), (-w, y, z + d - c), (-(w - c), y, z + d)]

def oval_ring(y, w, d, z=0.0, n=12, square=2.6):
    """A horizontal n-sided rounded-box cross-section at height y (a superellipse: square=2 is an
    oval, higher is boxier), w half-width, d half-depth, centered at depth z."""
    pts = []
    for i in range(n):
        a = i * 2 * math.pi / n + math.pi / n
        sx, cz = math.sin(a), math.cos(a)
        k = (abs(sx) ** square + abs(cz) ** square) ** (-1 / square)
        pts.append((w * sx * k, y, z + d * cz * k))
    return pts

def round_ring(x, y, z, r, n=8, rz=None):
    """A horizontal n-sided ring of radius r (depth radius rz) around (x, z) at height y."""
    rz = r if rz is None else rz
    return [(x + math.sin(i * 2 * math.pi / n + math.pi / n) * r, y, z + math.cos(i * 2 * math.pi / n + math.pi / n) * rz) for i in range(n)]

def face_ring(z, y, w, top, bot, x=0.0):
    """A vertical cross-section at depth z (for heads and bodies that run front to back), centered
    at height y: 8 points clockwise from the top: top, upper side, side, lower side, bottom, and back
    up the other side. w = half width, top/bot = height above/below the center."""
    return [(x, y + top, z), (x + 0.78 * w, y + 0.72 * top, z), (x + w, y + 0.05 * top, z), (x + 0.72 * w, y - 0.68 * bot, z),
            (x, y - bot, z), (x - 0.72 * w, y - 0.68 * bot, z), (x - w, y + 0.05 * top, z), (x - 0.78 * w, y + 0.72 * top, z)]

def sweep(bm, path, radius, n=6, up=(0, 0, 1), cap=True):
    """Drag an n-sided ring along `path` (game points); radius is a number or a list (one per
    point). The ring is kept square to `up` (good for flat shapes like a horseshoe). Returns
    loft()'s faces."""
    rs = radius if isinstance(radius, (list, tuple)) else [radius] * len(path)
    P = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        b = Vector(up).normalized()
        if abs(b.dot(t)) > 0.95:          # the path runs along `up`: use another reference
            b = Vector((0, 1, 0)) if abs(t.y) < 0.95 else Vector((1, 0, 0))
        nrm = b.cross(t).normalized()
        b = t.cross(nrm).normalized()
        rings.append([tuple(p + (nrm * math.cos(a) + b * math.sin(a)) * rs[i]) for a in (j * 2 * math.pi / n + math.pi / n for j in range(n))])
    return loft(bm, rings, cap, cap)

def skin_tree(name, mat, bone, nodes, edges, root, subdivide=True):
    """A branching shape (antlers, roots, twigs) wrapped by Blender's Skin modifier.
    nodes: {key: ((x, y, z), radius)} in game space; edges: [(key, key)]; root: the key it grows from."""
    bm = bmesh.new()
    sk = bm.verts.layers.skin.verify()
    vs = {}
    for key, (p, r) in nodes.items():
        v = bm.verts.new(G(*p))
        v[sk].radius = (r, r)
        vs[key] = v
    vs[root][sk].use_root = True
    for a, b in edges:
        bm.edges.new((vs[a], vs[b]))
    me = bpy.data.meshes.new(name + 'Skel')
    bm.to_mesh(me); bm.free()
    tmp = bpy.data.objects.new(name + 'Skel', me)
    COLL[0].objects.link(tmp)
    tmp.modifiers.new('Skin', 'SKIN')
    if subdivide:
        sub = tmp.modifiers.new('Subdivision', 'SUBSURF'); sub.levels = sub.render_levels = 1
    out = evaluated_mesh(tmp)
    bpy.data.objects.remove(tmp, do_unlink=True); bpy.data.meshes.remove(me)
    for p in out.polygons:
        p.use_smooth = False
    ob = bpy.data.objects.new(name, out)
    COLL[0].objects.link(ob)
    out.materials.append(MAT[mat])
    PARTS.append((ob, bone))
    return ob

# ---------- ray casting, to sit details on a surface ----------
def bvh(ob):
    return BVHTree.FromPolygons([v.co.copy() for v in ob.data.vertices], [list(p.vertices) for p in ob.data.polygons])

def surf(tree, start, direction):
    """Where a ray from game point `start` heading along game `direction` first hits the mesh (game space)."""
    loc, nor, _, _ = tree.ray_cast(G(*start), G(*direction).normalized())
    if loc is None:
        raise RuntimeError('ray from %s along %s missed' % (start, direction))
    return back(loc), back(nor)

def reach(trees, start, direction, pick):
    """The farthest-out surface point along one axis over several meshes (rays that miss are skipped).
    pick(point) gives the coordinate to compare; returns the largest."""
    hits = []
    for t in trees:
        loc, _, _, _ = t.ray_cast(G(*start), G(*direction).normalized())
        if loc is not None:
            hits.append(pick(back(loc)))
    return max(hits)

# ---------- small composite shapes (creatures and props) ----------
def tube(bm, a, b, ra, rb, n=6):
    """A tapered limb from point a (radius ra) to b (radius rb)."""
    return sweep(bm, [a, b], [ra, rb], n)

def spike(bm, at, d, r, ln, n=4):
    """A cone (thorn, claw, tooth, horn tip) with its base at `at`, pointing along d."""
    d = Vector(d).normalized()
    return cyl(bm, 0.0, r, ln, n, place(Vector(at) + d * (ln / 2), aim(d)))

def blob(bm, c, rx, ry, rz, u=8, v=5, rot=(0, 0, 0)):
    """A low-poly ellipsoid (eyes, joints, moss, petals)."""
    return ball(bm, 1, u, v, place(c, rot, (rx, ry, rz)))

def egg_rings(c, rx, ry, rz, n=10, m=7, top=1.0, bot=1.0):
    """Rings for lofting an ellipsoid along Y (top/bot squash the upper/lower halves)."""
    cx, cy, cz = c
    rings = []
    for i in range(m):
        a = -math.pi / 2 * 0.86 + i * (math.pi * 0.86) / (m - 1)
        y = cy + ry * math.sin(a) * (top if a > 0 else bot)
        k = math.cos(a)
        rings.append(round_ring(cx, y, cz, rx * k, n, rz * k))
    return rings

def egg(bm, c, rx, ry, rz, n=10, m=7, top=1.0, bot=1.0):
    return loft(bm, egg_rings(c, rx, ry, rz, n, m, top, bot))

def hoop(bm, center, r, tube_r, n=12, m=5, up=(0, 1, 0)):
    """A ring (belt, crown band, chain link): a circle of radius r around `up`, swept closed."""
    c, u = Vector(center), Vector(up).normalized()
    a = u.orthogonal().normalized()
    b = u.cross(a)
    pts = [tuple(c + (a * math.cos(t) + b * math.sin(t)) * r) for t in (i * 2 * math.pi / n for i in range(n + 1))]
    return sweep(bm, pts, tube_r, m, up=tuple(u), cap=False)

# ---------- rigging ----------
def chain(y, bones, cuts):
    """Weights for a point at height y along a chain: bones bottom→top, cuts = (joint height, blend half-width)."""
    for i, (c, w) in enumerate(cuts):
        if y < c - w:
            return {bones[i]: 1.0}
        if y < c + w:
            t = (y - (c - w)) / (2 * w)
            return {bones[i]: 1 - t, bones[i + 1]: t}
    return {bones[-1]: 1.0}

def rig(name, bones, weights_for, skinned, info=None, parts=None, offset=(0, 0, 0)):
    """Build an armature `name` from bones [(name, parent, head, tail)] (game space, relative to
    `offset`) and attach parts: those whose PARTS tag is in `skinned` get vertex groups from
    weights_for(tag, game point) → {bone: weight}; the rest are rigid, parented to the bone their
    tag names. info (a dict) is stored for the game as the armature's "rig" property."""
    off = Vector(offset)
    arm_data = bpy.data.armatures.new(name)
    rig_ob = bpy.data.objects.new(name, arm_data)
    COLL[0].objects.link(rig_ob)
    bpy.context.view_layer.objects.active = rig_ob
    rig_ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bname, parent, h, t in bones:
        eb = arm_data.edit_bones.new(bname)
        eb.head, eb.tail = G(*(Vector(h) + off)), G(*(Vector(t) + off))
        if parent:
            eb.parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    rig_ob.select_set(False)
    arm_data.display_type = 'STICK'
    rig_ob.show_in_front = True
    rig_ob['rig'] = json.dumps(info or {})
    for ob, how in (parts if parts is not None else PARTS):
        ob.parent = rig_ob
        if how in skinned:
            groups = {}
            for v in ob.data.vertices:
                for bone, w in weights_for(how, back(v.co) - off).items():
                    if bone not in groups:
                        groups[bone] = ob.vertex_groups.new(name=bone)
                    groups[bone].add([v.index], w, 'REPLACE')
            ob.modifiers.new('Armature', 'ARMATURE').object = rig_ob
        else:
            ob.parent_type = 'BONE'
            ob.parent_bone = how
    bpy.context.view_layer.update()
    for ob, how in (parts if parts is not None else PARTS):
        if ob.parent_type == 'BONE':
            ob.matrix_world = Matrix.Identity(4)   # keep the mesh where it was built
    bpy.context.view_layer.update()
    return rig_ob
