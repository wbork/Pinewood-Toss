/* =========================================================================
   camera.js — the over-the-shoulder camera, and finding what the crosshair
   is pointing at.
   ========================================================================= */

// back:   distance behind the deer (meters)
// side:   offset to the deer's right, so the deer sits left of the crosshair
// height: how high above the deer's feet the camera aims from
const CAM = { back: 4.2, side: 0.8, height: 2.0 };
let camLen = CAM.back; // current distance; shrinks when the ground is in the way

/**
 * Place the camera behind the deer for this frame.
 * Only the ground can pull it closer (e.g. when looking up). Trees are ignored on
 * purpose: zooming in for every trunk was disorienting, and dither.js makes trees
 * between the camera and the deer see-through instead.
 */
function placeCamera(dt) {
  const p = player.pos, cp = Math.cos(pitch);
  // f = the direction the camera looks; the camera sits behind the pivot along -f
  const fx = -Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = -Math.cos(yaw) * cp;
  const px = p.x + Math.cos(yaw) * CAM.side, py = p.y + CAM.height, pz = p.z - Math.sin(yaw) * CAM.side;
  // walk back along the boom; if a point dips into the ground, stop just short of it
  let len = CAM.back;
  for (let t = 0.5; t <= CAM.back; t += 0.15) {
    const x = px - fx * t, y = py - fy * t, z = pz - fz * t;
    if (y < h(x, z) + 0.35) { len = Math.max(1.2, t - 0.2); break; }
  }
  // pull in quickly, ease back out slowly, so it never snaps
  camLen += (len - camLen) * Math.min(1, dt * (len < camLen ? 10 : 4));
  camera.position.set(px - fx * camLen, py - fy * camLen, pz - fz * camLen);
  camera.rotation.set(pitch, yaw, 0);
  if (shake > 0 && !reduceMotion) camera.position.add(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.3));
}

// Scratch vectors for aimPoint.
const ray = new V3(), rayO = new V3(), rayC = new V3();

/**
 * The 3D point under the crosshair: the first creature along the camera's line of
 * sight, otherwise where that line meets the ground, otherwise a point 50 m away.
 * Throws are aimed at this point (combat.js).
 */
function aimPoint(out) {
  camera.getWorldDirection(ray);
  rayO.copy(camera.position);
  const minT = camLen + 0.5; // ignore anything between the camera and the deer
  let best = 50;
  // creatures: treat each as a sphere around its middle, slightly padded so they're easier to target
  for (const e of foes) {
    if (e.state === 'dying') continue;
    centerOf(e, rayC).sub(rayO);
    const t = rayC.dot(ray), rr = e.def.r + 0.2 + (e.def.hi - e.def.lo) / 2;
    if (t > minT && t < best && rayC.lengthSq() - t * t < rr * rr) best = t;
  }
  // ground: step along the line every 0.5 m until it goes underground
  for (let t = minT; t < best; t += 0.5) {
    const x = rayO.x + ray.x * t, y = rayO.y + ray.y * t, z = rayO.z + ray.z * t;
    if (y < h(x, z)) { best = t; break; }
  }
  return out.copy(rayO).addScaledVector(ray, best);
}
