// Herramienta de prueba de HOOK: ms de cada pieza del mar abierto (mínimo de N repeticiones).
import { boot, parseArgs } from '../../../../tools/node-env.mjs';
const f = parseArgs();
await boot();
const P = (p) => import(new URL(p, import.meta.url).href);
const { layer, resetLayers } = await P('../../../engine/layer.js');
const A = await P('../../../art/index.js');
await A.initArt({ clouds: ['golden'], seeds: [1, 2, 3, 5] });
const { seaCam, pushK } = await P('../reveal/cam.js');
const { shipPoseAt } = await P('../reveal/ship.js');
const { drawBackdrop } = await P('../reveal/backdrop.js');
const B = await P('../reveal/birds.js');
const { drawSwell } = await P('../reveal/swell.js');
const Hn = await P('../reveal/horn.js');
const { drawDolphins, drawNearDolphins } = await P('../reveal/dolphins.js');
const { drawLensDrops } = await P('../reveal/lens.js');
const { drawFallout } = await P('../reveal/rain.js');
const n = Number(f.n ?? 4);
for (const t of String(f.t ?? '4.3').split(',').map(Number)) {
  const c0 = seaCam(t); const k = pushK(t);
  const cam = { ...c0, r: 0, z: c0.z * Math.exp(1.35 * k) };
  const o = shipPoseAt(t, { ...c0, r: 0 });
  const parts = {
    backdrop: (c) => drawBackdrop(c, t, cam), ship: (c) => A.drawShip(c, t, o), swell: (c) => drawSwell(c, t, cam),
    skyGulls: (c) => B.drawSkyGulls(c, t, cam), lowGulls: (c) => B.drawLowGulls(c, t, cam), flock: (c) => B.drawFlock(c, t, cam),
    near: (c) => B.drawNearGulls(c, t), dolphins: (c) => drawDolphins(c, t, cam), nearDol: (c) => drawNearDolphins(c, t, cam),
    steam: (c) => Hn.drawHornSteam(c, t, o), ripple: (c) => Hn.drawHornRipple(c, t, o), flare: (c) => Hn.drawFlareSweep(c, t, { x: 1750, y: 130, r: 66 }),
    lens: (c) => drawLensDrops(c, t), fallout: (c) => drawFallout(c, t),
  };
  const row = { t };
  for (const [name, fn] of Object.entries(parts)) {
    let best = 1e9;
    for (let i = 0; i < n; i++) { resetLayers(); const L = layer(); const c = L.getContext('2d'); const a = performance.now(); fn(c); c.getImageData(0, 0, 1, 1); best = Math.min(best, performance.now() - a); }
    row[name] = +best.toFixed(1);
  }
  console.log(JSON.stringify(row));
}
