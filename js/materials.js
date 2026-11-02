/* =========================================================================
   materials.js — textures painted in code, shared materials, and a helper
   for building models out of simple shapes. Used by creatures, the deer,
   balls and pickups.
   ========================================================================= */

/**
 * Paint a texture with the 2D canvas API instead of loading an image file.
 * `draw(ctx, width, height)` does the painting.
 */
function tex(w, hgt, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  draw(c.getContext('2d'), w, hgt);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

// The thrown ball: cream with an orange stripe, so you can see it spin.
const ballTex = tex(64, 32, (g, w, hgt) => {
  g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, hgt);
  g.fillStyle = '#d7552f'; g.fillRect(0, hgt / 2 - 4, w, 8);
});

// A soft white dot that fades to transparent: used for glowing halos.
const glowTex = tex(64, 64, (g, w) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(0.35, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});

/** A glowing halo material in the given color (always faces the camera when used on a Sprite). */
const glow = color => new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });

/** Standard low-poly material: matte and flat-shaded unless options say otherwise. */
const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, flatShading: true }, o));

// Materials shared by many models.
const MAT = {
  thorn: std({ color: 0x1f1219 }),   // imp spikes, legs and arms
  bark: std({ color: 0x3e2a1c }),    // stump legs
  moss: std({ color: 0x4f7a33 }),    // Mossback's back
  heart: std({ color: 0xe0384a, emissive: 0x5a0710, roughness: 0.4 }), // health pickup
  magnet: std({ color: 0xc8392b, roughness: 0.5 }),                      // XP magnet body
  steel: std({ color: 0xd8dde0, roughness: 0.3, metalness: 0.7 }),       // XP magnet tips
  mushStem: std({ color: 0xe8dcc0 }),                                    // spore puffer stem
};

// Creature eyes use "basic" materials, which ignore lighting, so they look like they glow.
const EYE = {
  amber: new THREE.MeshBasicMaterial({ color: 0xffb43a }),  // bramble imp
  red: new THREE.MeshBasicMaterial({ color: 0xff4a2a }),    // hollow stump
  pale: new THREE.MeshBasicMaterial({ color: 0xf0e2ff }),   // gloom wisp
  orange: new THREE.MeshBasicMaterial({ color: 0xff8a1c }), // mossback
  lime: new THREE.MeshBasicMaterial({ color: 0xb8ff5a }),   // spore puffer, sap shaman
};

/** Make a mesh at (x, y, z) with shadows on. The building block for every model. */
const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
};
