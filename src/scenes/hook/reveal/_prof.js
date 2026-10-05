// Perfil por partes de reveal-sea (ms con rasterizado forzado). Uso:
//   node src/art/_tools/sbx.mjs --module=src/scenes/hook/reveal/_prof.js --t=4.4,5.6 --out=shots/hook/sea/prof --only-sheet
import scene from '../../reveal-sea.js';
import { seaCam, pushK } from './cam.js';
import { drawBackdrop } from './backdrop.js';
import { shipPoseAt } from './ship.js';
import { drawShip } from '../../../art/index.js';
import { drawHullFx } from './hull.js';
import { drawSwell } from './swell.js';
import { drawSkyGulls, drawLowGulls } from './birds.js';

export async function init() { await scene.init(); }

const lap = (ctx, name, fn, acc) => {
  ctx.getImageData(0, 0, 1, 1);
  const a = performance.now();
  fn();
  ctx.getImageData(0, 0, 1, 1);
  acc.push(`${name} ${(performance.now() - a).toFixed(1)}`);
};

export function draw(ctx, t) {
  const acc = [];
  const k = pushK(t);
  const c0 = seaCam(t);
  const cam = { ...c0, r: 0, z: c0.z * Math.exp(1.35 * k) };
  const o = shipPoseAt(t, { ...c0, r: 0 });
  lap(ctx, 'backdrop', () => drawBackdrop(ctx, t, cam), acc);
  lap(ctx, 'gulls', () => { drawSkyGulls(ctx, t, cam); drawLowGulls(ctx, t, cam); }, acc);
  lap(ctx, 'ship', () => drawShip(ctx, t, o), acc);
  lap(ctx, 'swell', () => drawSwell(ctx, t, cam), acc);
  lap(ctx, 'hull', () => drawHullFx(ctx, t, o, k), acc);
  lap(ctx, 'scene', () => scene.draw(ctx, t), acc);
  lap(ctx, 'scene2', () => scene.draw(ctx, t), acc);
  console.error(`t=${t} ` + acc.join(' · '));
}
