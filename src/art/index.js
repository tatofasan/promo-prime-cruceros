// Kit de ilustración compartido de ART: un solo import para todo, más initArt() para precalcular.
//   import { initArt, drawSky, drawSun, drawOcean, drawShip, SHIP, drawWaveMask, drawWaveCrest } from '../art/index.js';
// Documentación y ejemplos: src/art/README.md · hojas de muestras: shots/art/.
export { SKY_PRESETS, SEA_PRESETS, PRESET_NAMES, mixPreset, resolve as resolvePreset, skyOf, seaOf, lightOf, litColor } from './presets.js';
export { drawSky, skyPoint, horizonScreen, SKY_DEPTH } from './sky.js';
export { drawSun, drawFlare } from './sun.js';
export { drawClouds, initClouds } from './clouds.js';
export { drawOcean, seaDepth, seaFrac, SEA_NEAR_DEPTH } from './ocean.js';
export { drawShip, SHIP, shipPoint, shipPorthole, shipPoseFor, shipZoom, shipBob, initShip, drawHorn, drawSmoke } from './ship.js';
export { drawWaveMask, drawWaveCrest, waveGeom, waveFrontX } from './wave.js';
export { drawPorthole, PORTHOLE } from './porthole.js';
export { drawGulls, gull } from './gulls.js';
export { drawPalm, drawIsland, TROPIC } from './tropics.js';
export { drawGlitter, drawConfetti, drawHalo } from './fxkit.js';
export { waveColors, drawFoamLace, drawDroplets, drawDrop, drawSpray, drawSplash, blobInto, alongPath } from './water.js';

import { initSkyArt } from './sky.js';
import { initShip } from './ship.js';
import { initClouds } from './clouds.js';
import { waveGeom } from './wave.js';

/**
 * Precalcula lo pesado del kit (geometría del barco, estrellas, sprites de nubes). Llamalo en el init()
 * de tu escena: `async init() { await initArt({ clouds: ['golden'] }); }`. Es idempotente.
 * o.clouds: presets cuyos sprites de nubes conviene tener listos (def. ninguno: se arman al primer uso).
 */
export async function initArt(o = {}) {
  initSkyArt();
  initShip();
  if (o.clouds && o.clouds.length) initClouds(o.seeds ?? [1, 2, 3], o.clouds);
  waveGeom(0.5);
}
