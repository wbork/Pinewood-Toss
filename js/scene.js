/* =========================================================================
   scene.js — the 3D stage: renderer, camera, sky, sunlight, and the slow
   shift from daylight to dusk as a run goes on.
   ========================================================================= */

// ---------- Renderer ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // cap at 2x so 4K screens don't tank the frame rate
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;    // soft-edged shadows

// ---------- Scene and fog ----------
const scene = new THREE.Scene();
// Fog fades distant things into the sky color; it turns purple-grey at dusk.
const FOG_DAY = new THREE.Color(0xc9dcc4), FOG_DUSK = new THREE.Color(0x8a7f98);
scene.fog = new THREE.Fog(FOG_DAY.getHex(), 45, 230);

// ---------- Camera ----------
// camera.js places it behind the deer every frame. 'YXZ' order means yaw is
// applied before pitch, the usual setup for a mouse-look camera.
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = 'YXZ';

// ---------- Sky ----------
// A huge sphere seen from inside, colored from the fog color at the horizon to blue overhead.
// Its material color tints the whole sky toward dusk later (see dusk()).
const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
{
  const g = new THREE.SphereGeometry(450, 24, 12);
  const p = g.attributes.position, top = new THREE.Color(0x6aa4d4), cols = [];
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, p.getY(i) / 450); // 0 at the horizon, 1 straight up
    const c = FOG_DAY.clone().lerp(top, Math.pow(t, 0.55));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(g, skyMat));
}

// ---------- Lights ----------
// Hemisphere light: soft fill, bluish from above and greenish bounce from below.
const hemi = new THREE.HemisphereLight(0xd8ecff, 0x3f5229, 0.8);
scene.add(hemi);

// The sun: the only light that casts shadows. Its shadow box is 80 m wide and
// follows the deer (game.js moves it each frame), so shadows stay sharp nearby.
const SUN_DAY = new THREE.Color(0xfff0d0), SUN_DUSK = new THREE.Color(0xffa070), SKY_DUSK = new THREE.Color(0x8d7aa8);
const sun = new THREE.DirectionalLight(SUN_DAY.getHex(), 0.95);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SUN_OFF = new V3(35, 60, 22); // where the sun sits relative to the deer

/**
 * Shift the lighting from afternoon toward dusk as the run goes on.
 * Reaches its darkest (70% of the way to full dusk) at 8 minutes.
 */
function dusk() {
  const k = Math.min(1, runTime / 480) * 0.7;
  scene.fog.color.copy(FOG_DAY).lerp(FOG_DUSK, k);
  skyMat.color.setRGB(1, 1, 1).lerp(SKY_DUSK, k);
  hemi.intensity = 0.8 - 0.32 * k;
  sun.intensity = 0.95 - 0.35 * k;
  sun.color.copy(SUN_DAY).lerp(SUN_DUSK, k);
}

// Keep the picture sharp and undistorted when the window is resized.
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
