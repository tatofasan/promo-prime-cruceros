// Transición de ola simulada: escena gris (vieja) → mar (nueva), como la compone el compositor:
// vieja abajo · nueva recortada con drawWaveMask · cresta encima. ART_WAVE = hook | close | up
import { W, H } from '../engine/time.js';
import { layer } from '../engine/layer.js';
import { PAL } from '../engine/color.js';
import { HOOK_WAVE, CLOSE_WAVE } from '../scenes/waves.js';
import { drawWaveMask, drawWaveCrest } from './wave.js';
import { drawSky, skyPoint } from './sky.js';
import { drawSun } from './sun.js';
import { drawOcean } from './ocean.js';
import { drawShip } from './ship.js';

const MODE = globalThis.process?.env?.ART_WAVE ?? 'hook';
const WV = MODE === 'close' ? CLOSE_WAVE : HOOK_WAVE;
const DIR = MODE === 'up' ? 'up' : WV.dir;
const PRESET = MODE === 'close' ? 'sunset' : 'golden';

function oldScene(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, PAL.grey500); g.addColorStop(1, PAL.grey700);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PAL.grey400;
  for (let i = 0; i < 6; i++) ctx.fillRect(120 + i * 300, 160, 200, 300);
  ctx.fillStyle = PAL.grey900;
  ctx.fillRect(0, 760, W, 320);
  ctx.fillStyle = PAL.grey200;
  ctx.font = '900 150px Outfit';
  ctx.fillText('VACACIONES…', 110, 640);
}
function newScene(ctx, t) {
  const sun = MODE === 'close' ? [1350, 470, 95] : [1500, 230, 70];
  const hz = MODE === 'close' ? 600 : 640;
  drawSky(ctx, t, { preset: PRESET, horizonY: hz, sunX: sun[0], sunY: sun[1] });
  const [sx, sy] = skyPoint(null, sun[0], sun[1]);
  drawSun(ctx, t, sx, sy, sun[2], { preset: PRESET, flare: 0.6 });
  drawOcean(ctx, t, { preset: PRESET, horizonY: hz, sunX: sun[0], sunY: sun[1] });
  drawShip(ctx, t, { x: 1150, y: hz + 22, scale: 0.34, preset: PRESET });
}

export function draw(ctx, t) {
  const p = WV.p(t);
  oldScene(ctx);
  const L = layer();
  const lc = L.getContext('2d');
  newScene(lc, t);
  const M = layer();
  drawWaveMask(M.getContext('2d'), p, { dir: DIR });
  lc.globalCompositeOperation = 'destination-in';
  lc.drawImage(M, 0, 0);
  ctx.drawImage(L, 0, 0);
  drawWaveCrest(ctx, t, p, { dir: DIR, preset: PRESET });
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(14, 14, 220, 44);
  ctx.fillStyle = '#FFD27A';
  ctx.font = '600 28px Outfit';
  ctx.fillText(`p = ${p.toFixed(3)}`, 26, 46);
}
