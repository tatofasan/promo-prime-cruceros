// Ola v3 (barril) a p FIJO (t = p): escena gris (vieja) → mar (nueva), compuesta como el compositor.
//   ART_WAVE = hook | close | up · ART_WMODE = full | mask (solo máscara sobre gris) | dbg (full + polilíneas)
import { W, H } from '../engine/time.js';
import { layer } from '../engine/layer.js';
import { PAL } from '../engine/color.js';
import { drawWaveMask, drawWaveCrest, waveGeom } from './wave.js';
import { drawSky, skyPoint } from './sky.js';
import { drawSun } from './sun.js';
import { drawOcean } from './ocean.js';
import { drawShip } from './ship.js';

const MODE = globalThis.process?.env?.ART_WAVE ?? 'hook';
const WM = globalThis.process?.env?.ART_WMODE ?? 'full';
const DIR = MODE === 'up' ? 'up' : MODE === 'close' ? 'ltr' : 'rtl';
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
  const hz = MODE === 'close' ? 640 : 650;
  drawSky(ctx, t, { preset: PRESET, horizonY: hz, sunX: sun[0], sunY: sun[1] });
  const [sx, sy] = skyPoint(null, sun[0], sun[1]);
  drawSun(ctx, t, sx, sy, sun[2], { preset: PRESET, flare: 0.6 });
  drawOcean(ctx, t, { preset: PRESET, horizonY: hz, sunX: sun[0], sunY: sun[1] });
  drawShip(ctx, t, { x: 1150, y: hz + 22, scale: 0.34, preset: PRESET });
}

export function draw(ctx, t) {
  const p = t;
  const tt = 3.6 + p * 0.3;
  oldScene(ctx);
  const L = layer();
  const lc = L.getContext('2d');
  newScene(lc, tt);
  const M = layer();
  drawWaveMask(M.getContext('2d'), p, { dir: DIR });
  lc.globalCompositeOperation = 'destination-in';
  lc.drawImage(M, 0, 0);
  ctx.drawImage(L, 0, 0);
  if (WM !== 'mask') drawWaveCrest(ctx, tt, p, { dir: DIR, preset: PRESET, spray: 1.35, foam: 1.2 });
  if (WM === 'dbg' && DIR === 'rtl') {
    const G = waveGeom(p, { dir: DIR });
    const line = (P, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
    line(G.front, '#ff00ff'); line(G.back, '#ffff00'); line(G.face, '#00ff00'); line(G.belly, '#ff8800'); line(G.lomo, '#00ffff');
    for (const [x, y] of G.front) { ctx.fillStyle = '#ff00ff'; ctx.fillRect(x - 3, y - 3, 6, 6); }
    ctx.fillStyle = '#ff0000'; ctx.fillRect(G.X - 4, 0, 8, H);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(14, 14, 220, 44);
  ctx.fillStyle = '#FFD27A';
  ctx.font = '600 28px Outfit';
  ctx.fillText(`p = ${p.toFixed(3)}`, 26, 46);
}
