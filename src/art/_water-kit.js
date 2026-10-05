// Hoja del KIT DE AGUA (water.js): encaje, gotas, spray y splash a 3 escalas, presets day y golden.
//   t = 100·preset + 10·panel + p   (preset 0 day · 1 golden; panel 0 = kit + splash 80/200 · panel 1 = splash 450)
//   node tools/sandbox.mjs --module=src/art/_water-kit.js --t=0.12,0.3,0.55,0.85,10.3,10.55 --sheet --cols=3
import { drawSky } from './sky.js';
import { drawOcean } from './ocean.js';
import { drawFoamLace, drawDroplets, drawSpray, drawSplash, waveColors } from './water.js';
import { PAL } from '../engine/color.js';

const NAMES = ['day', 'golden'];

function label(ctx, s, x, y) {
  ctx.font = '600 26px Outfit';
  ctx.fillStyle = 'rgba(4,16,31,0.55)';
  const w = ctx.measureText(s).width;
  ctx.fillRect(x - 10, y - 28, w + 20, 38);
  ctx.fillStyle = '#FFE9B8';
  ctx.fillText(s, x, y);
}

export function draw(ctx, t) {
  const preset = NAMES[Math.min(1, Math.floor(t / 100))];
  const panel = Math.floor((t % 100) / 10);
  const p = (t % 10);
  const tt = p * 1.3;
  const hz = 260;
  drawSky(ctx, tt, { preset, horizonY: hz, sunX: 1500, sunY: 120, rays: 0.5 });
  drawOcean(ctx, tt, { preset, horizonY: hz, sunX: 1500, sunY: 120, glitter: 0.6 });
  const C = waveColors(preset);
  if (panel === 1) {
    drawSplash(ctx, tt, 960, 900, p, { size: 450, preset, seed: 21 });
    label(ctx, `${preset} · drawSplash size 450 · p ${p.toFixed(2)}`, 40, 60);
    return;
  }
  // encaje: banda ondulada abierta + anillo cerrado (sobre un plano de agua oscura para ver los agujeros)
  ctx.fillStyle = C.face2;
  ctx.fillRect(40, 320, 600, 300);
  const band = [];
  for (let i = 0; i <= 20; i++) band.push([60 + i * 28, 410 + Math.sin(i * 0.6 + tt) * 26]);
  drawFoamLace(ctx, tt, band, { width: 70, seed: 3, preset, flow: 40 });
  const ring = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ring.push([340 + Math.cos(a) * 150, 545 + Math.sin(a) * 50]); }
  drawFoamLace(ctx, tt, ring, { width: 46, seed: 8, preset, closed: true });
  label(ctx, 'drawFoamLace', 60, 360);
  // gotas
  drawDroplets(ctx, tt, { x: 160, y: 900, w: 200, h: 10 }, p, { count: 26, seed: 4, preset, size: 9, speed: 1100, gravity: 2200, spread: 1.1 });
  label(ctx, 'drawDroplets', 60, 700);
  // spray direccional
  drawSpray(ctx, tt, 760, 640, -0.5, Math.min(0.99, p * 1.1 + 0.02), { preset, count: 80, speed: 900, size: 3.6 });
  label(ctx, 'drawSpray', 700, 360);
  // splash a dos escalas
  drawSplash(ctx, tt, 1180, 930, p, { size: 80, preset, seed: 5 });
  drawSplash(ctx, tt, 1590, 930, p, { size: 200, preset, seed: 9 });
  label(ctx, `${preset} · drawSplash 80 / 200 · p ${p.toFixed(2)}`, 1100, 360);
  ctx.fillStyle = PAL.white;
}
