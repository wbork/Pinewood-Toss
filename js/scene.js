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
// It's always dusk in these woods: a low orange sun, a bruised purple sky, and a mauve fog that
// creeps in close. Over a run it deepens toward night (see dusk()).
const FOG_DUSK = new THREE.Color(0x7a6280), FOG_NIGHT = new THREE.Color(0x3a3048);
scene.fog = new THREE.Fog(FOG_DUSK.getHex(), 20, 165);

// ---------- Camera ----------
// camera.js places it behind the deer every frame. 'YXZ' order means yaw is
// applied before pitch, the usual setup for a mouse-look camera.
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = 'YXZ';

// The sun hangs low over the horizon (about 19° up), so shadows stretch long across the ground.
const SUN_OFF = new V3(60, 26, 45); // where the sun sits relative to the deer
const SUN_DIR = SUN_OFF.clone().normalize();

// ---------- Sky ----------
// A huge sphere seen from inside. At the horizon it glows orange on the sun's side and fades to
// dusky mauve on the far side; above, it darkens through violet to deep indigo overhead.
// Its material color tints the whole sky toward night over a run (see dusk()).
const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
{
  const g = new THREE.SphereGeometry(450, 32, 16);
  const p = g.attributes.position, cols = [];
  const glowSide = new THREE.Color(0xf08a52), farSide = new THREE.Color(0x8a6a8a), mid = new THREE.Color(0x5a4678), top = new THREE.Color(0x221d3c);
  const sh = new V3(SUN_DIR.x, 0, SUN_DIR.z).normalize(), d = new V3();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const t = Math.max(0, d.y);                                  // 0 at the horizon, 1 straight up
    const face = Math.max(0, new V3(d.x, 0, d.z).normalize().dot(sh)); // 1 facing the sun
    const horizon = farSide.clone().lerp(glowSide, Math.pow(face, 2.5));
    const c = t < 0.3 ? horizon.lerp(mid, Math.pow(t / 0.3, 0.8)) : mid.clone().lerp(top, Math.pow((t - 0.3) / 0.7, 0.7));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(g, skyMat));
}
// The sun itself: a soft orange disc with a wide glow, sunk low near the horizon.
const sunDisc = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.12, 'rgba(255,190,120,1)'); gr.addColorStop(0.2, 'rgba(255,140,80,0.55)'); gr.addColorStop(1, 'rgba(255,100,60,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true }));
  s.position.copy(SUN_DIR).multiplyScalar(420); s.scale.setScalar(150); s.renderOrder = -1;
  scene.add(s);
  return s;
})();

// ---------- Lights ----------
// Hemisphere light: a dim violet fill from the sky and a dark mossy bounce from below.
const HEMI_SKY = new THREE.Color(0x9a86b8);
const hemi = new THREE.HemisphereLight(HEMI_SKY.getHex(), 0x2a2a1e, 0.62);
scene.add(hemi);

// The sun: the only light that casts shadows. Its shadow box is 80 m wide and
// follows the deer (game.js moves it each frame), so shadows stay sharp nearby.
const SUN_DUSK = new THREE.Color(0xffa060), SUN_NIGHT = new THREE.Color(0xff6a4a), SKY_NIGHT = new THREE.Color(0x6a5c86);
const sun = new THREE.DirectionalLight(SUN_DUSK.getHex(), 0.9);
sun.castShadow = true;
// sharper shadows on graphics cards that allow a 4096 shadow map (most do), else 2048
const shadowRes = renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
sun.shadow.mapSize.set(shadowRes, shadowRes);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/**
 * Deepen the dusk toward night as the run goes on: the fog and sky darken, the sun sinks redder
 * and dimmer. Reaches its darkest (65% of the way to night) at 8 minutes, still light enough to fight in.
 */
function dusk() {
  const k = Math.min(1, runTime / 480) * 0.65;
  scene.fog.color.copy(FOG_DUSK).lerp(FOG_NIGHT, k);
  scene.fog.far = 165 - 45 * k;                      // the fog closes in
  skyMat.color.setRGB(1, 1, 1).lerp(SKY_NIGHT, k);
  hemi.intensity = 0.62 - 0.2 * k;
  sun.intensity = 0.9 - 0.4 * k;
  sun.color.copy(SUN_DUSK).lerp(SUN_NIGHT, k);
  sunDisc.material.color.setRGB(1, 1, 1).lerp(SUN_NIGHT, k);
}

// Keep the picture sharp and undistorted when the window is resized.
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
