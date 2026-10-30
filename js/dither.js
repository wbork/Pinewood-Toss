/* =========================================================================
   dither.js — keeps the deer visible behind trees and rocks.

   Scenery that sits between the camera and the deer is drawn with a
   "screen-door" pattern inside a circle around the deer: a checkerboard of
   pixels is skipped, so you see the deer through the gaps. The circle fades
   at its edge so there's no hard ring.

   It works by patching the scenery materials' shaders (addDither). All the
   patched materials share the same three settings (uniforms), which
   updateDither() refreshes once per frame from the deer's screen position.
   Shadows are drawn by a different shader, so they stay solid.
   ========================================================================= */

// Shared shader inputs:
//   uDitherCenter — the deer's middle on screen, in pixels from the bottom-left
//   uDitherDepth  — the deer's depth; only pixels nearer than this get dithered
//   uDitherRadius — circle size in pixels (0 turns the effect off)
const dither = {
  uDitherCenter: { value: new THREE.Vector2() },
  uDitherDepth: { value: 0 },
  uDitherRadius: { value: 0 },
};

/** Patch a material so it dithers around the deer. Returns the same material for easy chaining. */
function addDither(mat) {
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, dither);
    shader.fragmentShader = shader.fragmentShader
      // Declare the inputs, plus a 4×4 Bayer matrix: a fixed grid of thresholds
      // that turns "skip 60% of pixels here" into an even checkered pattern.
      .replace('#include <common>', `#include <common>
uniform vec2 uDitherCenter;
uniform float uDitherDepth;
uniform float uDitherRadius;
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }`)
      // At the top of the pixel shader: if this pixel is in front of the deer and inside
      // the circle, skip ("discard") it when its Bayer threshold is below the fade amount.
      .replace('void main() {', `void main() {
  if (uDitherRadius > 0.0 && gl_FragCoord.z < uDitherDepth) {
    float k = 1.0 - smoothstep(uDitherRadius * 0.55, uDitherRadius, length(gl_FragCoord.xy - uDitherCenter));
    if (k * 0.8 > bayer4(gl_FragCoord.xy)) discard;
  }`);
  };
  return mat;
}

// Scratch values for updateDither.
const ditherFeet = new V3(), ditherHead = new V3(), bufferSize = new THREE.Vector2();

/** Recompute where the deer is on screen. Called once per frame just before rendering. */
function updateDither() {
  renderer.getDrawingBufferSize(bufferSize);
  // Project the deer's feet and the top of its antlers into screen space.
  ditherFeet.copy(player.pos).project(camera);
  ditherHead.copy(player.pos).setY(player.pos.y + 2.3).project(camera);
  // Off when the deer is behind the camera or lying down after death.
  if (ditherFeet.z > 1 || dead) { dither.uDitherRadius.value = 0; return; }
  // Convert from -1..1 screen coordinates to pixels.
  const sx = v => (v.x * 0.5 + 0.5) * bufferSize.x, sy = v => (v.y * 0.5 + 0.5) * bufferSize.y;
  const fx = sx(ditherFeet), fy = sy(ditherFeet), hx = sx(ditherHead), hy = sy(ditherHead);
  dither.uDitherCenter.value.set((fx + hx) / 2, (fy + hy) / 2);
  dither.uDitherRadius.value = Math.hypot(hx - fx, hy - fy) * 0.75;         // a bit bigger than the deer
  dither.uDitherDepth.value = (ditherFeet.z + ditherHead.z) / 4 + 0.5;      // average depth, as the GPU measures it (0..1)
}
